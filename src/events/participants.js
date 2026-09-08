import { log } from "../utils/logger.js";
export async function handleParticipants(sock, event, repo) {
  if (!["add", "remove"].includes(event.action)) return;
  const group = repo.group(event.id);
  log(
    "INFO",
    event.action === "add" ? "participants.joined" : "participants.left",
    { count: event.participants.length },
  );
  if (!(event.action === "add" ? group.welcome : group.goodbye)) return;
  const ids = event.participants.map((p) => (typeof p === "string" ? p : p.id));
  for (const id of ids) {
    const tag = "@" + id.split("@")[0];
    await sock.sendMessage(event.id, {
      text:
        event.action === "add"
          ? `🌙 Bem-vindo(a) ao grupo!\n\nOlá, ${tag}!\n\n${group.rules}\n\nLeia as regras e respeite os outros membros.\nEsperamos que você aproveite o grupo. ❤️`
          : `🌙 Até mais, ${tag}!`,
      mentions: [id],
    });
  }
}
