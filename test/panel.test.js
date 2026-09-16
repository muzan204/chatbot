import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/local-panel.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function panel(hostname = 'localhost') {
  const nodes = new Map(), timers = new Map(), handlers = new Map();
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: true, textContent: '', dataset: {}, attrs: {},
      value: '', addEventListener(name, fn) { this[name] = fn; },
      getAttribute(name) { return this.attrs[name]; },
      removeAttribute(name) { delete this.attrs[name]; },
      set src(value) { this.attrs.src = value; },
    });
    return nodes.get(selector);
  };
  const root = element('panel'); root.querySelector = element;
  const links = [{ href: '#conectar', textContent: 'Conectar' }];
  let response = { connection: 'online', auth: null }, fail = false, count = 0, sequence = 0;
  const context = {
    document: { hidden: false, querySelector: () => root, querySelectorAll: () => links },
    location: { hostname, reload() {} }, window: { addEventListener: (name, fn) => handlers.set(name, fn) },
    AbortController, AbortSignal, Date,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async () => { count++; if (fail) throw new Error('offline'); return { ok: true, status: 200, json: async () => response }; },
  };
  vm.runInNewContext(source, context);
  return { element, root, links, timers, handlers, get count() { return count; },
    setResponse(value) { response = value; }, offline() { fail = true; },
    async poll() { const [id, timer] = [...timers].find(([, t]) => t.delay === 2000); timers.delete(id); timer.fn(); await tick(); },
  };
}
test('painel remove indicação online quando o servidor fica indisponível', async () => {
  const p = panel(); await tick();
  assert.equal(p.element('[data-connection-state]').dataset.online, 'true');
  p.offline(); await p.poll();
  assert.equal(p.element('[data-connection-state]').dataset.online, 'false');
  assert.equal(p.element('[data-connection-state]').textContent, 'Bot indisponível');
});
test('painel externo exige chave antes de consultar QR', async () => {
  const p = panel('example.com'); await tick();
  assert.equal(p.element('[data-panel-login]').hidden, false);
  assert.equal(p.root.hidden, false);
  assert.equal(p.count, 0);
  p.element('[data-panel-secret]').value = 'test-secret';
  p.element('[data-panel-login]').submit({ preventDefault() {} });
  await tick();
  assert.equal(p.count, 1);
  assert.equal(p.element('[data-panel-login]').hidden, true);
});
test('QR expira e sair da página cancela consultas e remove código', async () => {
  const p = panel(); await tick();
  p.setResponse({ connection: 'awaiting_auth', auth: { qrDataUrl: 'data:image/png;base64,test', expiresAt: Date.now() + 40000 } });
  await p.poll();
  assert.equal(p.element('[data-qr-image]').hidden, false);
  const expiry = [...p.timers.values()].find(t => t.delay > 30000);
  expiry.fn();
  assert.equal(p.element('[data-qr-image]').hidden, true);
  assert.equal(p.element('[data-qr-image]').getAttribute('src'), undefined);
  p.handlers.get('pagehide')();
  assert.equal(p.timers.size, 0);
});
test('WhatsApp desativado mostra orientação em vez de aguardar QR', async () => {
  const p = panel(); await tick();
  p.setResponse({ connection: 'disabled', auth: null }); await p.poll();
  assert.match(p.element('[data-connection-help]').textContent, /WHATSAPP_ENABLED/);
  assert.match(p.element('[data-qr-message]').textContent, /desativado/);
});
