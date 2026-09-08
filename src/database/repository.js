import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
export const groupDefaults = () => ({
  welcome: false,
  goodbye: false,
  antilink: false,
  xp: false,
  ai: false,
  prefix: "",
  rules: "Respeite os membros. Não envie spam.",
  warnings: {},
  muted: {},
  users: {},
});
// Uma instância/processo por arquivo. Substitua esta interface ao migrar de banco.
export class Repository {
  constructor(file) {
    this.file = file;
    this.state = { version: 1, groups: {}, users: {} };
    this.pending = Promise.resolve();
  }
  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT")
        throw new Error("Banco inválido; restaure o backup antes de iniciar.");
    }
    if (this.state.version !== 1 || !this.state.groups || !this.state.users)
      throw new Error("Banco incompatível");
    return this;
  }
  group(id) {
    return (this.state.groups[id] ||= groupDefaults());
  }
  user(id) {
    return (this.state.users[id] ||= { messages: 0 });
  }
  activity(groupId, userId, cooldown, now = Date.now()) {
    this.user(userId).messages++;
    if (!groupId) return;
    const g = this.group(groupId);
    const u = (g.users[userId] ||= { messages: 0, xp: 0, lastXp: 0 });
    u.messages++;
    if (g.xp && now - u.lastXp >= cooldown) {
      u.xp += 10;
      u.lastXp = now;
    }
  }
  save() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        await writeFile(this.file + ".tmp", snapshot, { mode: 0o600 });
        await rename(this.file + ".tmp", this.file);
      });
    return this.pending;
  }
}
