import {
  jidNormalizedUser,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";
import { commands } from "../commands/index.js";
import { Gate, UserError, clean, authorize, hasLink } from "../utils/safety.js";
import { log } from "../utils/logger.js";
const cooldown = new Gate(),
  expensive = new Gate(),
  seen = new Gate(30000),
  replies = new Gate();
export const participantMatches = (p, ids) =>
  [p.id, p.phoneNumber, p.lid]
    .filter(Boolean)
    .some((id) =>
      ids
        .filter(Boolean)
        .map(jidNormalizedUser)
        .includes(jidNormalizedUser(id)),
    );
export async function handleMessage(sock, message, repo, config) {
  const started = Date.now(),
    chat = message.key.remoteJid;
  if (
    !chat ||
    message.key.fromMe ||
    !message.message ||
    chat === "status@broadcast" ||
    (!chat.endsWith("@g.us") &&
      !chat.endsWith("@s.whatsapp.net") &&
      !chat.endsWith("@lid"))
  )
    return;
  if (!seen.take(chat + ":" + message.key.id, 3600000)) return;
  const content = normalizeMessageContent(message.message) || {};
  const raw =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    "";
  const text = clean(raw),
    isGroup = chat.endsWith("@g.us");
  let sender = jidNormalizedUser(message.key.participant || chat);
  const reply = async (text, mentions = []) =>
    sock.sendMessage(
      chat,
      { text: String(text).slice(0, config.maxLength), mentions },
      { quoted: message },
    );
  try {
    const group = isGroup ? repo.group(chat) : null;
    const prefix = group?.prefix || config.prefix;
    const isCommand = text.startsWith(prefix);
    // Permissões consultadas novamente em cada mensagem: sem cache de administradores obsoleto.
    const metadata = isGroup ? await sock.groupMetadata(chat) : null;
    const actor = metadata?.participants.find((p) =>
      participantMatches(p, [sender, message.key.participantAlt]),
    );
    sender = actor?.id || sender;
    const self = metadata?.participants.find((p) =>
      participantMatches(p, [sock.user?.id, sock.user?.lid]),
    );
    const isAdmin = !!actor?.admin,
      botAdmin = !!self?.admin;
    if (
      isGroup &&
      !isAdmin &&
      botAdmin &&
      ((group.muted[sender] || 0) > Date.now() ||
        (group.antilink && hasLink(raw)))
    ) {
      await sock.sendMessage(chat, { delete: message.key });
      return;
    }
    if (raw.length > config.maxLength) return;
    repo.activity(isGroup ? chat : null, sender, config.xpCooldown);
    await repo.save();
    if (!isCommand) {
      if (
        /^(oi|olá|ola|bom dia|boa noite)$/i.test(text) &&
        replies.take(chat + ":" + sender, 60000)
      )
        await reply(
          `🌙 Olá! Use ${prefix}menu para conhecer o ${config.name}.`,
        );
      return;
    }
    if (!cooldown.take(chat + ":" + sender, config.cooldown)) return;
    const [name, ...args] = text.slice(prefix.length).trim().split(/\s+/),
      command = name.toLowerCase(),
      cmd = commands.get(command);
    if (!cmd) {
      await reply(`Comando desconhecido. Use ${prefix}menu.`);
      return;
    }
    const info =
      content.extendedTextMessage?.contextInfo ||
      content.imageMessage?.contextInfo ||
      content.videoMessage?.contextInfo ||
      {};
    const ctx = {
      sock,
      repo,
      config,
      chat,
      sender,
      started,
      isGroup,
      group,
      prefix,
      metadata,
      isAdmin,
      botAdmin,
      selfId: self?.id,
      displayName: clean(message.pushName) || "Usuário",
      command,
      args,
      text: args.join(" "),
      content,
      quoted: normalizeMessageContent(info.quotedMessage),
      reply,
      send: (payload) => sock.sendMessage(chat, payload, { quoted: message }),
      requireText: (usage) => {
        if (!args.length) throw new UserError(`Use: ${prefix}${usage}`);
      },
      target: () => {
        const id = info.mentionedJid?.[0] || info.participant;
        const p = metadata?.participants.find((p) =>
          participantMatches(p, [id]),
        );
        if (!p)
          throw new UserError(
            "Mencione um participante ou responda à mensagem dele.",
          );
        return p;
      },
    };
    authorize(cmd, ctx);
    if (cmd.expensive && !expensive.take(sender, 15000))
      throw new UserError(
        "Aguarde 15 segundos entre pedidos de IA ou figurinha.",
      );
    await cmd.run(ctx);
    log("INFO", "command.executed", { command });
  } catch (error) {
    log(error instanceof UserError ? "AVISO" : "ERRO", "message.failed");
    try {
      await reply(
        error instanceof UserError
          ? error.message
          : "Não consegui concluir. Verifique as permissões e tente novamente.",
      );
    } catch {
      log("AVISO", "reply.failed");
    }
  }
}
