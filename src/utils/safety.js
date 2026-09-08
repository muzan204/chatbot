export class UserError extends Error {}
export const clean = (text) =>
  String(text || "")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .trim();
export class Gate {
  constructor(limit = 10000) {
    this.items = new Map();
    this.limit = limit;
  }
  take(key, ms, now = Date.now()) {
    const until = this.items.get(key);
    if (until > now) return false;
    if (this.items.size >= this.limit) {
      for (const [k, t] of this.items) if (t <= now) this.items.delete(k);
      if (this.items.size >= this.limit) return false;
    }
    this.items.set(key, now + ms);
    return true;
  }
}
export function authorize(command, ctx) {
  if (command.group && !ctx.isGroup)
    throw new UserError("Este comando funciona somente em grupos.");
  if (command.admin && !ctx.isAdmin)
    throw new UserError("Somente administradores podem usar este comando.");
  if (command.botAdmin && !ctx.botAdmin)
    throw new UserError("Preciso ser administrador do grupo para fazer isso.");
}
export const hasLink = (text) =>
  /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|(?:[\p{L}\d-]+\.)+(?:com|net|org|br|io|gg|me)\b)/iu.test(
    clean(text),
  );
