import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { calculate } from "../src/utils/calculator.js";
import { authorize, Gate, hasLink } from "../src/utils/safety.js";
import { Repository } from "../src/database/repository.js";
import { createApp } from "../src/services/server.js";
import { participantMatches, handleMessage } from "../src/events/messages.js";
import { permanentDisconnect } from "../src/services/connection.js";
test("calculadora respeita precedência e recusa execução", () => {
  assert.equal(calculate("2*(3+4)-1"), 13);
  for (const s of ["process.exit()", "1/0", "2**3", "(2+3", "1;2"])
    assert.throws(() => calculate(s));
});
test("permissões falham fechadas", () => {
  const cmd = { group: true, admin: true, botAdmin: true };
  for (const ctx of [{}, { isGroup: true }, { isGroup: true, isAdmin: true }])
    assert.throws(() => authorize(cmd, ctx));
  assert.doesNotThrow(() =>
    authorize(cmd, { isGroup: true, isAdmin: true, botAdmin: true }),
  );
});
test("cooldown e limites", () => {
  const gate = new Gate(1);
  assert.equal(gate.take("a", 100, 0), true);
  assert.equal(gate.take("a", 100, 10), false);
  assert.equal(gate.take("b", 100, 10), false);
  assert.equal(gate.take("b", 100, 101), true);
});
test("links e identidades PN/LID", () => {
  assert.ok(hasLink("veja https://example.com"));
  assert.ok(hasLink("chat.whatsapp.com/abc"));
  assert.equal(hasLink("boa noite"), false);
  assert.ok(
    participantMatches({ id: "123@lid", phoneNumber: "555@s.whatsapp.net" }, [
      "555:2@s.whatsapp.net",
    ]),
  );
  assert.ok(permanentDisconnect(401));
  assert.equal(permanentDisconnect(408), false);
});
test("persistência, isolamento por grupo e XP antispam", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "noturnos-test-"));
  try {
    const file = path.join(dir, "db.json");
    const r = await new Repository(file).init();
    r.group("a").xp = true;
    r.activity("a", "u", 60000, 60001);
    r.activity("a", "u", 60000, 60002);
    r.activity("b", "u", 60000, 60003);
    assert.equal(r.group("a").users.u.xp, 10);
    assert.equal(r.group("b").users.u.xp, 0);
    await Promise.all([r.save(), r.save()]);
    assert.equal(JSON.parse(await readFile(file)).groups.a.users.u.messages, 2);
    assert.equal((await new Repository(file).init()).group("a").xp, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("HTTP publica apenas saúde e estado", async () => {
  const app = createApp(
    { name: "OS NOTURNOS" },
    { connection: "awaiting_auth" },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await (await fetch(base + "/health")).json(), {
      status: "online",
      bot: "OS NOTURNOS",
    });
    assert.equal(
      (await (await fetch(base + "/api/status")).json()).connection,
      "awaiting_auth",
    );
    assert.equal((await fetch(base + "/auth")).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("integração: usuário comum não pode banir; anti-link apaga e ignora admin", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "noturnos-flow-"));
  try {
    const repo = await new Repository(path.join(dir, "db.json")).init(),
      sent = [],
      actions = [];
    const sock = {
      user: { id: "999@s.whatsapp.net" },
      groupMetadata: async () => ({
        subject: "Teste",
        participants: [
          { id: "user@lid" },
          { id: "admin@lid", admin: "admin" },
          { id: "bot@lid", phoneNumber: "999@s.whatsapp.net", admin: "admin" },
        ],
      }),
      sendMessage: async (_chat, payload) => sent.push(payload),
      groupParticipantsUpdate: async (...a) => {
        actions.push(a);
        return [{ status: "200" }];
      },
    };
    const cfg = {
      name: "OS NOTURNOS",
      prefix: "!",
      maxLength: 4000,
      cooldown: 1,
      xpCooldown: 60000,
    };
    const msg = (id, sender, text) => ({
      key: { remoteJid: "test@g.us", participant: sender, id },
      message: { conversation: text },
    });
    await handleMessage(sock, msg("1", "user@lid", "!ban"), repo, cfg);
    assert.equal(actions.length, 0);
    assert.match(sent.at(-1).text, /administradores/);
    repo.group("test@g.us").antilink = true;
    await handleMessage(
      sock,
      msg("2", "user@lid", "https://example.com"),
      repo,
      cfg,
    );
    assert.equal(sent.at(-1).delete.id, "2");
    const count = sent.length;
    await handleMessage(
      sock,
      msg("3", "admin@lid", "https://example.com"),
      repo,
      cfg,
    );
    assert.equal(sent.length, count);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
