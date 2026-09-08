import express from "express";
import { localOnly } from '../utils/local-only.js';
export function createApp(config, status) {
  const app = express();
  app.disable("x-powered-by");
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
  if (config.siteDir) app.use(express.static(config.siteDir, { dotfiles: 'deny', index: 'index.html' }));
  app.use((_req, res) =>
    res.status(404).json({ error: "Rota não encontrada" }),
  );
  return app;
}
