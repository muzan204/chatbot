import express from "express";
import { timingSafeEqual } from "node:crypto";
import { localOnly } from '../utils/local-only.js';

function isLocalRequest(req) {
  const host = (req.get('host') || '').toLowerCase();
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createApp(config, status) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" });
    next();
  });
  if (!config.siteDir) app.get("/", (_req, res) =>
    res
      .type("text/plain")
      .send(`${config.name} — serviço ativo. Consulte /health e /api/status.`),
  );

  app.get('/api/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store, private');
    if (isLocalRequest(req)) return localOnly(req, res, next);
    next();
  }, (req, res) => {
    res.set('Cache-Control', 'no-store, private');

    if (!isLocalRequest(req)) {
      if (!config.panelSecret) {
        return res.status(503).json({ error: 'Painel remoto não configurado.' });
      }

      const authHeader = req.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!safeEqual(token, config.panelSecret)) {
        return res.status(401).json({ error: 'Chave do painel inválida.' });
      }
    }

    const auth = status.auth && status.auth.expiresAt > Date.now() ? status.auth : null;
    res.json({ connection: status.connection, auth });
  });

  app.get("/health", (_req, res) =>
    res.json({ status: "online", bot: config.name }),
  );

  app.get("/api/status", (_req, res) =>
    res.set('Cache-Control', 'no-store').json({
      bot: config.name,
      connection: status.connection,
      connectedAt: status.connectedAt || null,
      uptime: Math.floor(process.uptime()),
    }),
  );
  app.get('/ready', (_req, res) => {
    const ready = status.connection === 'online' && !status.credentialsError;
    res.status(ready ? 200 : 503).set('Cache-Control', 'no-store').json({ ready });
  });
  if (config.siteDir) app.use(express.static(config.siteDir, { dotfiles: 'deny', index: 'index.html' }));
  app.use((_req, res) =>
    res.status(404).json({ error: "Rota não encontrada" }),
  );
  return app;
}
