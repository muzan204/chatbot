import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WorkQueue } from '../src/utils/queue.js';
import { connect } from '../src/services/connection.js';
import { Repository, validateDatabase } from '../src/database/repository.js';
import { handleMessage } from '../src/events/messages.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const waitFor = async predicate => {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.fail('Condição não atingida');
};
async function repository(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'noturnos-reliable-'));
  const repo = await new Repository(path.join(dir, 'db.json'), { flushMs: 20 }).init();
  t.after(async () => { await repo.close(); await rm(dir, { recursive: true, force: true }); });
  return { repo, dir };
}
function fakeRuntime(extra = {}) {
  const sockets = [];
  let saves = 0;
  return {
    sockets, get saves() { return saves; }, retryDelay: 0,
    authState: async () => ({ state: { creds: { registered: true } }, saveCreds: async () => { saves++; } }),
    makeSocket: () => {
      const socket = { ev: new EventEmitter(), ended: false, end() { this.ended = true; } };
      sockets.push(socket); return socket;
    }, ...extra,
  };
}

test('fila mantém ordem por conversa, limita carga e libera outras conversas', async () => {
  const gate = deferred(), calls = [];
  const q = new WorkQueue({ concurrency: 2, perKey: 2, limit: 3 });
  q.add('a', async () => { calls.push('a1'); await gate.promise; });
  q.add('a', () => calls.push('a2'));
  assert.equal(q.add('a', () => {}), false);
  assert.equal(q.add('b', () => calls.push('b')), true);
  assert.equal(q.add('c', () => {}), false);
  await waitFor(() => calls.includes('b'));
  assert.deepEqual(calls, ['a1', 'b']);
  gate.resolve(); await q.close();
  assert.deepEqual(calls, ['a1', 'b', 'a2']);
  assert.equal(q.add('c', () => {}), false);
});

test('credenciais e conexão continuam durante comando lento e fila cheia', async () => {
  const gate = deferred(), runtime = fakeRuntime({ onMessage: () => gate.promise });
  const status = {}, stop = await connect({ maxReconnect: 2 }, {}, status, runtime);
  const socket = runtime.sockets[0];
  try {
    socket.ev.emit('messages.upsert', { type: 'notify', messages: Array.from({ length: 51 }, (_, i) => ({ key: { id: String(i), remoteJid: 'a' } })) });
    socket.ev.emit('creds.update', {});
    socket.ev.emit('connection.update', { connection: 'open' });
    await waitFor(() => runtime.saves === 1 && status.connection === 'online');
    const closing = stop();
    assert.equal(socket.ended, false);
    gate.resolve(); await closing;
    assert.equal(socket.ended, true);
  } finally { gate.resolve(); await stop(); }
});

test('reconexão única ignora socket antigo e encerra retries ao parar', async () => {
  const runtime = fakeRuntime(), status = {};
  const stop = await connect({ maxReconnect: 2 }, {}, status, runtime);
  try {
    const close = { connection: 'close', lastDisconnect: { error: { output: { statusCode: 408 } } } };
    runtime.sockets[0].ev.emit('connection.update', close);
    runtime.sockets[0].ev.emit('connection.update', close);
    await waitFor(() => runtime.sockets.length === 2);
    runtime.sockets[1].ev.emit('connection.update', { connection: 'open' });
    await waitFor(() => status.connection === 'online');
    runtime.sockets[0].ev.emit('connection.update', close);
    await new Promise(r => setTimeout(r, 15));
    assert.equal(status.connection, 'online');
    assert.equal(runtime.sockets.length, 2);
  } finally { await stop(); }
});

test('desconexão permanente exige intervenção e não apaga a sessão', async () => {
  const runtime = fakeRuntime(), status = {};
  const stop = await connect({ maxReconnect: 2 }, {}, status, runtime);
  runtime.sockets[0].ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
  await waitFor(() => status.connection === 'logged_out');
  assert.equal(runtime.sockets.length, 1);
  await stop();
});

test('falha de credenciais fica observável e pode ser recuperada', async () => {
  let fail = true;
  const runtime = fakeRuntime({ authState: async () => ({ state: { creds: {} }, saveCreds: async () => { if (fail) throw new Error('disk'); } }) });
  const status = {}, stop = await connect({ maxReconnect: 1 }, {}, status, runtime);
  runtime.sockets[0].ev.emit('creds.update', {});
  await waitFor(() => status.credentialsError === true);
  fail = false; runtime.sockets[0].ev.emit('creds.update', {});
  await waitFor(() => status.credentialsError === false);
  await stop();
});

test('banco completa campos antigos e rejeita dados internos inválidos', () => {
  const data = { version: 1, groups: { a: { xp: true } }, users: {} };
  assert.equal(validateDatabase(data).groups.a.rules.length > 0, true);
  for (const group of [{ muted: [] }, { xp: 'true' }, { users: { u: { messages: 0, xp: -1, lastXp: 0 } } }, { warnings: { u: [{}] } }])
    assert.throws(() => validateDatabase({ ...data, groups: { a: group } }));
});

test('backup recupera banco corrompido e preserva arquivo para diagnóstico', async t => {
  const { repo, dir } = await repository(t);
  repo.user('u').messages = 1; await repo.save();
  repo.user('u').messages = 2; await repo.save();
  await writeFile(repo.file, '{broken');
  const recovered = await new Repository(repo.file).init();
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.user('u').messages, 1);
  assert.ok((await readdir(dir)).some(name => name.includes('.corrupt-')));
  assert.equal(JSON.parse(await readFile(repo.file)).users.u.messages, 1);
});

test('contadores agrupam gravações e encerramento persiste o último estado', async t => {
  const { repo } = await repository(t);
  let writes = 0;
  const original = repo.atomic.bind(repo);
  repo.atomic = async (...args) => { writes++; return original(...args); };
  for (let i = 0; i < 100; i++) repo.activity('g', 'u', 60000);
  assert.equal(writes, 0);
  await waitFor(() => writes >= 2); await repo.pending;
  assert.equal(writes, 2);
  assert.equal(JSON.parse(await readFile(repo.file)).users.u.messages, 100);
  repo.activity('g', 'u', 60000); await repo.close();
  assert.equal(JSON.parse(await readFile(repo.file)).users.u.messages, 101);
});

test('conversa comum evita metadados; comando administrativo consulta permissões atuais', async t => {
  const { repo } = await repository(t);
  let metadataCalls = 0; const replies = [];
  const socket = {
    user: { id: 'bot@lid' },
    groupMetadata: async () => { metadataCalls++; return { participants: [{ id: 'u@lid' }, { id: 'bot@lid', admin: 'admin' }] }; },
    sendMessage: async (_chat, payload) => replies.push(payload),
  };
  const config = { prefix: '!', maxLength: 4000, cooldown: 1, xpCooldown: 60000 };
  const msg = (id, text) => ({ key: { remoteJid: 'fresh@g.us', participant: 'u@lid', id }, message: { conversation: text } });
  await handleMessage(socket, msg('ordinary', 'conversa normal'), repo, config);
  assert.equal(metadataCalls, 0);
  await handleMessage(socket, msg('admin', '!fechar'), repo, config);
  assert.equal(metadataCalls, 1);
  assert.match(replies.at(-1).text, /administradores/);
});
