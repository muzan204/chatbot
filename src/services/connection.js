import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { handleMessage } from "../events/messages.js";
import { handleParticipants } from "../events/participants.js";
import { log } from "../utils/logger.js";
import { WorkQueue, SerialQueue } from "../utils/queue.js";
export const permanentDisconnect = (code) =>
  [401, 403, 440, 500, 411].includes(code);
export async function connect(config, repo, status, runtime = {}) {
  log("INFO", config.authMode === "pairing" ? "auth.mode.pairing" : "auth.mode.qr");
  const authState = runtime.authState || useMultiFileAuthState;
  const makeSocket = runtime.makeSocket || makeWASocket;
  const onMessage = runtime.onMessage || handleMessage;
  const onParticipants = runtime.onParticipants || handleParticipants;
  const { state, saveCreds } = await authState(config.authDir);
  let socket,
    timer,
    stopped = false,
    attempt = 0;
  const control = new SerialQueue(() => log("ERRO", "connection.event.failed"));
  const credentials = new SerialQueue(() => { status.credentialsError = true; log("ERRO", "credentials.save.failed"); });
  const work = new WorkQueue({ concurrency: config.concurrency || 4, onError: () => log("ERRO", "event.failed") });
  const schedule = () => {
    if (stopped || timer) return;
    if (attempt >= config.maxReconnect) {
      status.connection = "failed";
      log("ERRO", "reconnect.limit");
      return;
    }
    attempt++;
    status.connection = "reconnecting";
    status.auth = null;
    log("RECONEXÃO", "connection.retry", { attempt });
    timer = setTimeout(
      () => {
        timer = undefined;
        open().catch(() => {
          log("AVISO", "connection.retry.failed");
          schedule();
        });
      },
      runtime.retryDelay ?? Math.min(30000, 1000 * 2 ** (attempt - 1)),
    );
  };
  async function open() {
    if (stopped) return;
    status.connection = "connecting";
    await credentials.idle();
    if (stopped) return;
    const sock = makeSocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      qrTimeout: 60000,
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 15000,
    });
    socket = sock;
    let pairingRequested = false, retired = false;
    sock.ev.on("creds.update", () => credentials.add(async () => {
      await saveCreds();
      status.credentialsError = false;
    }));
    sock.ev.on("connection.update", (update) =>
      control.add(async () => {
        if (sock !== socket || stopped || retired) return;
        if (update.qr && !state.creds.registered) {
          status.connection = "awaiting_auth";
          if (config.authMode === "pairing") {
            if (!/^\d{10,15}$/.test(config.phone)) {
              status.connection = "invalid_config";
              stopped = true;
              sock.end(new Error("invalid config"));
              log("ERRO", "pairing.phone.invalid");
              return;
            }
            if (!pairingRequested) {
              pairingRequested = true;
              const code = await sock.requestPairingCode(config.phone);
              status.auth = { pairingCode: code, expiresAt: Date.now() + 55000 };
              if (config.authConsole) console.log(`WhatsApp: codigo de pareamento: ${code}`);
            }
          } else {
            if (config.authConsole) {
              console.log('WhatsApp: escaneie este QR em Aparelhos conectados. Nao compartilhe este console.');
              console.log(await QRCode.toString(update.qr, { type: 'terminal', small: true }));
            }
            status.auth = {
              qrDataUrl: await QRCode.toDataURL(update.qr, { width: 320, margin: 4, errorCorrectionLevel: 'M' }),
              expiresAt: Date.now() + 55000,
            };
            log('INFO', 'auth.qr.ready');
          }
        }
        if (update.connection === "open") {
          clearTimeout(timer);
          timer = undefined;
          status.connection = "online";
          status.auth = null;
          status.connectedAt = new Date().toISOString();
          attempt = 0;
          log("INFO", "connection.open");
        }
        if (update.connection === "close") {
          if (retired) return;
          retired = true;
          status.auth = null;
          status.connectedAt = null;
          const code = update.lastDisconnect?.error?.output?.statusCode;
          sock.ev.removeAllListeners("messages.upsert");
          sock.ev.removeAllListeners("group-participants.update");
          if (permanentDisconnect(code)) {
            status.connection = "logged_out";
            stopped = true;
            log("AVISO", "connection.requires_auth", { code });
            return;
          }
          if (code === DisconnectReason.restartRequired)
            log("INFO", "connection.restart_required");
          schedule();
        }
      }),
    );
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (!['notify', 'append'].includes(type) || stopped || retired) return;
      const now = Math.floor(Date.now() / 1000);
      for (const m of messages) {
        const timestamp = Number(m.messageTimestamp || 0);
        if (type === 'append' && (!timestamp || Math.abs(now - timestamp) > 120)) continue;
        log("INFO", "message.received");
        if (!work.add(m.key?.remoteJid, () => {
          if (!retired && sock === socket) return onMessage(sock, m, repo, config);
        })) log("AVISO", "queue.full");
      }
    });
    sock.ev.on("group-participants.update", event => {
      if (stopped || retired) return;
      if (!work.add(event.id, () => {
        if (!retired && sock === socket) return onParticipants(sock, event, repo);
      })) log("AVISO", "queue.full");
    });
  }
  try {
    await open();
  } catch {
    schedule();
  }
  return async () => {
    stopped = true;
    status.auth = null;
    clearTimeout(timer);
    await work.close();
    await control.idle();
    socket?.end(new Error("shutdown"));
    await credentials.idle();
    if (status.credentialsError) throw new Error("Falha ao salvar a sessão.");
  };
}
