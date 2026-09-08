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
export const permanentDisconnect = (code) =>
  [401, 403, 440, 500, 411].includes(code);
export async function connect(config, repo, status) {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  let socket,
    timer,
    stopped = false,
    attempt = 0,
    queue = Promise.resolve(),
    queued = 0;
  const enqueue = (fn) => {
    if (queued >= 200) {
      log("AVISO", "queue.full");
      return;
    }
    queued++;
    queue = queue
      .then(fn)
      .catch(() => log("ERRO", "event.failed"))
      .finally(() => queued--);
  };
  const schedule = () => {
    if (stopped) return;
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
      () =>
        open().catch(() => {
          log("AVISO", "connection.retry.failed");
          schedule();
        }),
      Math.min(30000, 1000 * 2 ** (attempt - 1)),
    );
  };
  async function open() {
    if (stopped) return;
    status.connection = "connecting";
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      qrTimeout: 60000,
    });
    socket = sock;
    let pairingRequested = false;
    sock.ev.on("creds.update", () => enqueue(saveCreds));
    sock.ev.on("connection.update", (update) =>
      enqueue(async () => {
        if (sock !== socket || stopped) return;
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
            }
          } else {
            status.auth = {
              qrDataUrl: await QRCode.toDataURL(update.qr, { width: 320, margin: 4, errorCorrectionLevel: 'M' }),
              expiresAt: Date.now() + 55000,
            };
            log('INFO', 'auth.qr.ready');
          }
        }
        if (update.connection === "open") {
          status.connection = "online";
          status.auth = null;
          status.connectedAt = new Date().toISOString();
          attempt = 0;
          log("INFO", "connection.open");
        }
        if (update.connection === "close") {
          status.auth = null;
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
      if (type !== "notify") return;
      for (const m of messages)
        enqueue(() => handleMessage(sock, m, repo, config));
    });
    sock.ev.on("group-participants.update", (event) =>
      enqueue(() => handleParticipants(sock, event, repo)),
    );
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
    socket?.end(new Error("shutdown"));
    await queue;
  };
}
