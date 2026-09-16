(() => {
  const panel = document.querySelector('[data-local-panel]');
  if (!panel) return;
  panel.hidden = false;

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const badge = panel.querySelector('[data-connection-state]');
  const help = panel.querySelector('[data-connection-help]');
  const image = panel.querySelector('[data-qr-image]');
  const placeholder = panel.querySelector('[data-qr-placeholder]');
  const message = panel.querySelector('[data-qr-message]');
  const pairing = panel.querySelector('[data-pairing-code]');
  const labels = { starting:'Iniciando o bot…', connecting:'Conectando ao WhatsApp…', awaiting_auth:'Aguardando leitura do QR Code', online:'WhatsApp conectado', reconnecting:'Reconectando…', failed:'Não foi possível conectar', logged_out:'Sessão encerrada', disabled:'WhatsApp desativado', invalid_config:'Verifique a configuração' };
  let expiryTimer, pollTimer, stopped = false;
  let panelSecret = '', inFlight = false, needsLogin = false;
  try { if (!isLocal) panelSecret = sessionStorage.getItem('os-noturnos-panel-secret') || ''; } catch {}
  const login = panel.querySelector('[data-panel-login]');
  const input = panel.querySelector('[data-panel-secret]');
  const feedback = panel.querySelector('[data-panel-login-error]');
  const remember = () => {
    try {
      if (panelSecret) sessionStorage.setItem('os-noturnos-panel-secret', panelSecret);
      else sessionStorage.removeItem('os-noturnos-panel-secret');
    } catch {}
  };
  const showLogin = (error = '') => {
    needsLogin = true;
    clearTimeout(expiryTimer); clearCode();
    login.hidden = false;
    badge.dataset.online = 'false'; badge.textContent = 'Painel protegido';
    help.textContent = 'Informe a chave do painel para liberar a conexão.';
    message.textContent = 'Autenticação necessária.';
    feedback.textContent = error;
  };
  login.addEventListener('submit', event => {
    event.preventDefault();
    if (inFlight || !input.value.trim()) return;
    panelSecret = input.value.trim(); needsLogin = false;
    clearTimeout(pollTimer); update();
  });
  const controller = new AbortController();
  window.addEventListener('pagehide', () => {
    stopped = true; clearTimeout(expiryTimer); clearTimeout(pollTimer); controller.abort(); clearCode();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  const clearCode = () => { image.hidden = true; image.removeAttribute('src'); pairing.hidden = true; pairing.textContent = ''; placeholder.hidden = false; };
  async function update() {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      if (!isLocal && !panelSecret) { showLogin(); return; }
      const response = await fetch('/api/auth', { cache:'no-store', headers: panelSecret ? { Authorization: `Bearer ${panelSecret}` } : {}, signal:AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      if (stopped) return;
      if (response.status === 401) {
        panelSecret = ''; remember(); showLogin('Chave inválida. Confira a configuração do painel.'); return;
      }
      if (response.status === 503) { showLogin('O painel remoto ainda não foi configurado pelo responsável.'); return; }
      if (response.status === 403) {
        clearTimeout(expiryTimer);
        clearCode(); badge.dataset.online = 'false'; badge.textContent = 'Pareamento pelo console';
        help.textContent = 'Neste ambiente, consulte o console privado do bot para conectar o WhatsApp.';
        message.textContent = 'QR protegido neste endereço.';
        return;
      }
      if (!response.ok) throw new Error('unavailable');

      login.hidden = true; needsLogin = false;
      if (panelSecret) { remember(); input.value = ''; }
      const data = await response.json();
      badge.textContent = labels[data.connection] || 'Verificando conexão…';
      badge.dataset.online = String(data.connection === 'online');
      help.textContent = data.connection === 'disabled' ? 'Ative WHATSAPP_ENABLED=true na configuração e reinicie o bot.' : data.connection === 'online' ? 'Tudo certo. Você pode usar os comandos no WhatsApp.' : ['failed','logged_out','invalid_config'].includes(data.connection) ? 'Confira o terminal do bot no VS Code e reinicie a tarefa após resolver o problema.' : 'O QR é atualizado automaticamente. Mantenha esta página aberta.';
      clearTimeout(expiryTimer);

      if (data.auth?.qrDataUrl?.startsWith('data:image/png;base64,') && data.auth.expiresAt > Date.now()) {
        placeholder.hidden = true;
        pairing.hidden = true;
        image.hidden = false;
        if (image.getAttribute('src') !== data.auth.qrDataUrl) image.src = data.auth.qrDataUrl;
        expiryTimer = setTimeout(() => {
          clearCode();
          message.textContent = 'Atualizando QR Code…';
        }, Math.max(0, data.auth.expiresAt - Date.now()));
      } else if (data.auth?.pairingCode && data.auth.expiresAt > Date.now()) {
        clearCode();
        placeholder.hidden = true;
        pairing.hidden = false;
        pairing.textContent = data.auth.pairingCode;
        expiryTimer = setTimeout(clearCode, Math.max(0, data.auth.expiresAt - Date.now()));
      } else {
        clearCode(); message.textContent = data.connection === 'online' ? 'Conectado com sucesso.' : data.connection === 'disabled' ? 'Bot desativado na configuração.' : ['failed','logged_out','invalid_config'].includes(data.connection) ? 'Resolva o problema indicado antes de conectar.' : 'Aguardando um novo QR Code…';
      }
    } catch {
      clearTimeout(expiryTimer); clearCode(); badge.textContent = 'Bot indisponível';
      badge.dataset.online = 'false';
      help.textContent = 'Inicie a tarefa “OS NOTURNOS: iniciar tudo” no VS Code. Este painel precisa do servidor do bot.';
      message.textContent = 'Aguardando o servidor local…';
    } finally {
      inFlight = false;
      if (!stopped && !needsLogin) pollTimer = setTimeout(update, document.hidden ? 10000 : 2000);
    }
  }

  update();
})();
