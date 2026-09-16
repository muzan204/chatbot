import express from "express";
import { localOnly } from '../utils/local-only.js';
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
  app.get('/api/auth', localOnly, (_req, res) => {
    res.set('Cache-Control', 'no-store, private');
    const auth = status.auth && status.auth.expiresAt > Date.now() ? status.auth : null;
    res.json({ connection: status.connection, auth });
  });
  // Liveness do processo: continua saudável enquanto aguarda autenticação.
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
