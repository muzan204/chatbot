import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/services/server.js';
import http from 'node:http';
const rawStatus = (url, headers) => new Promise((resolve, reject) => {
  http.get(url, { headers }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
});
test('QR local: sem cache, bloqueio de origem e domínio externos, expiração', async () => {
  const status = { connection: 'awaiting_auth', auth: { qrDataUrl: 'data:image/png;base64,test', expiresAt: Date.now() + 60000 } };
  const server = createApp({ name:'OS NOTURNOS' }, status).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + '/api/auth');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.ok((await response.json()).auth.qrDataUrl);
    assert.equal((await fetch(base + '/api/auth', { headers: { origin:'https://example.com' } })).status, 403);
    assert.equal(await rawStatus(base + '/api/auth', { host:'attacker.example' }), 403);
    assert.equal(await rawStatus(base + '/api/auth', { 'sec-fetch-site':'cross-site' }), 403);
    assert.equal((await (await fetch(base + '/api/status')).json()).auth, undefined);
    status.auth.expiresAt = 0;
    assert.equal((await (await fetch(base + '/api/auth')).json()).auth, null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
