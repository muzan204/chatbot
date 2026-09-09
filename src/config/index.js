import "dotenv/config";
import path from "node:path";

const number = (name, fallback, min = 1) => {
  const n = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(n) || n < min)
    throw new Error(`Configuração inválida: ${name}`);
  return n;
};

const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL);

export const config = {
  name: process.env.BOT_NAME || "OS NOTURNOS",
  prefix: process.env.PREFIX || "!",
  port: number("PORT", 3000),
  host: process.env.HOST || (isRender ? "0.0.0.0" : "127.0.0.1"),
  siteDir: path.resolve(process.env.SITE_DIR || "public"),
  openBrowser: process.env.OPEN_BROWSER !== "false" && !isRender,
  authDir: path.resolve(process.env.AUTH_DIR || "auth"),
  dataFile: path.resolve(process.env.DATA_FILE || "data/database.json"),
  enabled: process.env.WHATSAPP_ENABLED !== "false",
  authMode: process.env.AUTH_MODE || "qr",
  phone: process.env.PAIRING_PHONE || "",
  maxReconnect: number("MAX_RECONNECT_ATTEMPTS", 8),
  cooldown: number("COMMAND_COOLDOWN_MS", 3000),
  xpCooldown: number("XP_COOLDOWN_MS", 60000),
  maxLength: number("MAX_MESSAGE_LENGTH", 4000),
  timezone: process.env.TIMEZONE || "America/Sao_Paulo",
  maxMedia: number("MAX_MEDIA_BYTES", 10485760),
  maxVideo: number("MAX_VIDEO_SECONDS", 6),
};

if (!/^\S{1,5}$/u.test(config.prefix))
  throw new Error("PREFIX deve ter de 1 a 5 caracteres sem espaços.");

new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone });
