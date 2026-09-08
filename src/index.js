import { config } from "./config/index.js";
import { Repository } from "./database/repository.js";
import { connect } from "./services/connection.js";
import { createApp } from "./services/server.js";
import { log } from "./utils/logger.js";
import { openPanel } from './services/browser.js';
import { access } from 'node:fs/promises';
import path from 'node:path';
const status = { connection: config.enabled ? "starting" : "disabled" };
const repo = await new Repository(config.dataFile).init();
await access(path.join(config.siteDir, 'index.html'));
const server = createApp(config, status).listen(config.port, config.host);
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
}).catch(error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${config.port} já está em uso. Pare a outra instância do bot antes de iniciar.` : 'Não foi possível iniciar o servidor local.');
  process.exit(1);
});
log('INFO', 'http.started');
console.log(`🌙 Site e bot: http://127.0.0.1:${config.port}/#conectar`);
if (config.openBrowser && ['127.0.0.1', 'localhost', '0.0.0.0'].includes(config.host)) openPanel(config.port);
const stop = config.enabled
  ? await connect(config, repo, status)
  : async () => {};
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  log("INFO", "shutdown");
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  await stop();
  await repo.save();
  server.close(() => {
    clearTimeout(deadline);
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
