import { config } from './config/index.js';
import { Repository } from './database/repository.js';
import { connect } from './services/connection.js';

// Entrada exclusiva da hospedagem: sem servidor HTTP ou navegador.
if (!config.enabled) {
  console.error('Ative WHATSAPP_ENABLED para iniciar o bot na Discloud.');
  process.exit(1);
}
const repo = await new Repository(config.dataFile, { flushMs: config.flushMs }).init();
const status = { connection: 'starting' };
console.log('OS NOTURNOS: iniciando bot. O pareamento aparece neste console privado.');
const stop = await connect({ ...config, authConsole: true }, repo, status);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 150000);
  deadline.unref();
  try {
    try { await stop(); } finally { await repo.close(); }
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    console.error('Falha ao encerrar e salvar os dados do bot.');
    process.exit(1);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
