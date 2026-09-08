(() => {
  const panel = document.querySelector('[data-local-panel]');
  if (!panel || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  panel.hidden = false;
  const badge = panel.querySelector('[data-connection-state]');
  const help = panel.querySelector('[data-connection-help]');
  const image = panel.querySelector('[data-qr-image]');
  const placeholder = panel.querySelector('[data-qr-placeholder]');
  const message = panel.querySelector('[data-qr-message]');
  const pairing = panel.querySelector('[data-pairing-code]');
  const labels = { starting:'Iniciando o bot…', connecting:'Conectando ao WhatsApp…', awaiting_auth:'Aguardando leitura do QR Code', online:'WhatsApp conectado', reconnecting:'Reconectando…', failed:'Não foi possível conectar', logged_out:'Sessão encerrada', disabled:'WhatsApp desativado', invalid_config:'Verifique a configuração' };
  let expiryTimer;
  const clearCode = () => { image.hidden = true; image.removeAttribute('src'); pairing.hidden = true; pairing.textContent = ''; placeholder.hidden = false; };
  async function update() {
    try {
      const response = await fetch('/api/auth', { cache:'no-store', signal:AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      badge.textContent = labels[data.connection] || 'Verificando conexão…';
      badge.dataset.online = String(data.connection === 'online');
      help.textContent = data.connection === 'online' ? 'Tudo certo. Você pode usar os comandos no WhatsApp.' : ['failed','logged_out','invalid_config'].includes(data.connection) ? 'Confira o terminal do bot no VS Code e reinicie a tarefa após resolver o problema.' : 'O QR é atualizado automaticamente. Mantenha esta página aberta.';
      clearTimeout(expiryTimer);
      if (data.auth?.qrDataUrl?.startsWith('data:image/png;base64,') && data.auth.expiresAt > Date.now()) {
        placeholder.hidden = true; pairing.hidden = true; image.hidden = false;
        if (image.getAttribute('src') !== data.auth.qrDataUrl) image.src = data.auth.qrDataUrl;
        expiryTimer = setTimeout(() => { clearCode(); message.textContent = 'Atualizando QR Code…'; }, data.auth.expiresAt - Date.now());
      } else if (data.auth?.pairingCode && data.auth.expiresAt > Date.now()) {
        clearCode(); placeholder.hidden = true; pairing.hidden = false; pairing.textContent = data.auth.pairingCode;
        expiryTimer = setTimeout(clearCode, data.auth.expiresAt - Date.now());
      } else {
        clearCode(); message.textContent = data.connection === 'online' ? 'Conectado com sucesso.' : 'Aguardando um novo QR Code…';
      }
    } catch {
      clearTimeout(expiryTimer); clearCode(); badge.textContent = 'Bot indisponível';
      help.textContent = 'Inicie a tarefa “OS NOTURNOS: iniciar tudo” no VS Code. Este painel precisa do servidor do bot.';
      message.textContent = 'Aguardando o servidor local…';
    } finally { setTimeout(update, 2000); }
  }
  update();
})();
