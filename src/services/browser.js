import { spawn } from 'node:child_process';
import { log } from '../utils/logger.js';

export function openPanel(port) {
  // Only a validated numeric port is interpolated; no user-supplied shell text.
  if (!Number.isInteger(port) || port < 1 || port > 65535) return;
  const url = `http://127.0.0.1:${port}/#conectar`;
  const command = process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${url}'`]
    : [url];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.once('error', () => log('AVISO', 'browser.open_failed'));
  child.once('exit', code => log(code === 0 ? 'INFO' : 'AVISO', code === 0 ? 'browser.opened' : 'browser.open_failed'));
}
