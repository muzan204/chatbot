import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import { log } from "../utils/logger.js";
export const groupDefaults = () => ({
  welcome: false, goodbye: false, antilink: false, xp: false, ai: false,
  prefix: "", rules: "Respeite os membros. Não envie spam.",
  warnings: {}, muted: {}, users: {},
});
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
function map(value, validate) {
  if (!object(value)) throw new Error("Mapa inválido");
  const result = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Chave inválida");
    result[key] = validate(item);
  }
  return result;
}
export function validateDatabase(data) {
  if (!object(data) || data.version !== 1) throw new Error("Banco incompatível");
  const users = map(data.users, user => {
    if (!object(user) || !count(user.messages)) throw new Error("Usuário inválido");
    return { messages: user.messages };
  });
  const groups = map(data.groups, value => {
    if (!object(value)) throw new Error("Grupo inválido");
    const g = { ...groupDefaults(), ...value };
    for (const key of ["welcome", "goodbye", "antilink", "xp", "ai"])
      if (typeof g[key] !== "boolean") throw new Error("Configuração de grupo inválida");
    if (typeof g.prefix !== "string" || (g.prefix && !/^\S{1,5}$/u.test(g.prefix)) || typeof g.rules !== "string") throw new Error("Texto de grupo inválido");
    g.users = map(g.users, user => {
      if (!object(user) || ![user.messages, user.xp, user.lastXp].every(count)) throw new Error("XP inválido");
      return { messages: user.messages, xp: user.xp, lastXp: user.lastXp };
    });
    g.muted = map(g.muted, value => { if (!count(value)) throw new Error("Mute inválido"); return value; });
    g.warnings = map(g.warnings, list => {
      if (!Array.isArray(list) || list.length > 100 || list.some(w => !object(w) || typeof w.at !== "string" || !Number.isFinite(Date.parse(w.at)) || typeof w.reason !== "string")) throw new Error("Advertência inválida");
      return list;
    });
    return g;
  });
  return { version: 1, groups, users };
}
// One process per file. Counters are batched; administrative changes save immediately.
export class Repository {
  constructor(file, { flushMs = 2000 } = {}) {
    this.file = file;
    this.flushMs = flushMs;
    this.state = { version: 1, groups: Object.create(null), users: Object.create(null) };
    this.pending = Promise.resolve();
    this.recovered = false;
  }
  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.state = validateDatabase(JSON.parse(await readFile(this.file, "utf8")));
    } catch (primaryError) {
      if (primaryError.code && primaryError.code !== "ENOENT") throw primaryError;
      try {
        this.state = validateDatabase(JSON.parse(await readFile(this.file + ".bak", "utf8")));
      } catch (backupError) {
        if (primaryError.code === "ENOENT" && backupError.code === "ENOENT") return this;
        throw new Error("Banco e backup indisponíveis ou inválidos; preserve os arquivos e restaure uma cópia válida.");
      }
      if (primaryError.code !== "ENOENT") await copyFile(this.file, this.file + `.corrupt-${Date.now()}`);
      this.recovered = true;
      log("AVISO", "database.backup.restored");
      await this.atomic(this.file, JSON.stringify(this.state, null, 2));
    }
    this.lastGood = JSON.stringify(this.state, null, 2);
    return this;
  }
  group(id) { return (this.state.groups[id] ||= groupDefaults()); }
  user(id) { return (this.state.users[id] ||= { messages: 0 }); }
  activity(groupId, userId, cooldown, now = Date.now()) {
    this.user(userId).messages++;
    if (groupId) {
      const g = this.group(groupId);
      const u = (g.users[userId] ||= { messages: 0, xp: 0, lastXp: 0 });
      u.messages++;
      if (g.xp && now - u.lastXp >= cooldown) { u.xp += 10; u.lastXp = now; }
    }
    this.scheduleSave();
  }
  scheduleSave() {
    if (this.timer || this.closed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.save().catch(() => {
        log("ERRO", "database.save.failed");
        this.scheduleSave();
      });
    }, this.flushMs);
    this.timer.unref();
  }
  async atomic(file, snapshot) {
    await writeFile(file + ".tmp", snapshot, { mode: 0o600 });
    await rename(file + ".tmp", file);
  }
  save() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const snapshot = JSON.stringify(this.state, null, 2);
    this.pending = this.pending.catch(() => {}).then(async () => {
      await this.atomic(this.file + ".bak", this.lastGood || snapshot);
      await this.atomic(this.file, snapshot);
      this.lastGood = snapshot;
    });
    return this.pending;
  }
  async close() { this.closed = true; await this.save(); }
}
