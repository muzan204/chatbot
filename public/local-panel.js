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

  const labels = {
    starting: 'Iniciando o bot…',
    connecting: 'Conectando ao WhatsApp…',
    awaiting_auth: 'Aguardando leitura do QR Code',
    online: 'WhatsApp conectado',
    reconnecting: 'Reconectando…',
    failed: 'Não foi possível conectar',
    logged_out: 'Sessão encerrada',
    disabled: 'WhatsApp desativado',
    invalid_config: 'Verifique a configuração'
  };

  let expiryTimer;
  let retryTimer;
  let panelSecret = isLocal ? '' : (sessionStorage.getItem('os-noturnos-panel-secret') || '');

  const clearCode = () => {
    image.hidden = true;
    image.removeAttribute('src');
    pairing.hidden = true;
    pairing.textContent = '';
    placeholder.hidden = false;
  };

  const removeLogin = () => {
    panel.querySelector('[data-panel-login]')?.remove();
  };

  const showLogin = (errorText = '') => {
    if (isLocal) return;
    clearTimeout(retryTimer);
    clearCode();
    badge.textContent = 'Painel protegido';
    help.textContent = 'Digite a chave configurada em PANEL_SECRET no Render para liberar o QR Code.';
    message.textContent = 'Autenticação necessária.';

    let box = panel.querySelector('[data-panel-login]');
    if (!box) {
      box = document.createElement('form');
      box.dataset.panelLogin = 'true';
      box.style.cssText = 'grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:16px;border:1px solid rgba(139,92,246,.45);border-radius:14px;background:rgba(20,12,40,.72);backdrop-filter:blur(12px)';

      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'Chave do painel';
      input.autocomplete = 'current-password';
      input.required = true;
      input.style.cssText = 'flex:1;min-width:220px;padding:12px 14px;border-radius:10px;border:1px solid rgba(167,139,250,.35);background:#0b0714;color:#fff;outline:none';

      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = 'Liberar QR Code';
      button.style.cssText = 'padding:12px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#c026d3);color:#fff;font-weight:700;cursor:pointer';

      const feedback = document.createElement('span');
      feedback.dataset.panelLoginError = 'true';
      feedback.style.cssText = 'width:100%;font-size:13px;color:#f0abfc';

      box.append(input, button, feedback);
      box.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        panelSecret = value;
        sessionStorage.setItem('os-noturnos-panel-secret', panelSecret);
        feedback.textContent = 'Verificando…';
        update();
      });
      panel.prepend(box);
    }

    box.querySelector('[data-panel-login-error]').textContent = errorText;
  };

  async function update() {
    try {
      if (!isLocal && !panelSecret) {
        showLogin();
        return;
      }

      const headers = panelSecret ? { Authorization: `Bearer ${panelSecret}` } : {};
      const response = await fetch('/api/auth', {
        cache: 'no-store',
        headers,
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 401) {
        panelSecret = '';
        sessionStorage.removeItem('os-noturnos-panel-secret');
        showLogin('Chave inválida. Confira o valor de PANEL_SECRET no Render.');
        return;
      }

      if (response.status === 503) {
        showLogin('Defina PANEL_SECRET nas variáveis de ambiente do Render e faça um novo deploy.');
        return;
      }

      if (!response.ok) throw new Error('unavailable');

      removeLogin();
      const data = await response.json();
      badge.textContent = labels[data.connection] || 'Verificando conexão…';
      badge.dataset.online = String(data.connection === 'online');
      help.textContent = data.connection === 'online'
        ? 'Tudo certo. Você pode usar os comandos no WhatsApp.'
        : ['failed', 'logged_out', 'invalid_config'].includes(data.connection)
          ? 'Confira os logs do bot no Render e reinicie o serviço após resolver o problema.'
          : 'O QR é atualizado automaticamente. Mantenha esta página aberta.';

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
        clearCode();
        message.textContent = data.connection === 'online'
          ? 'Conectado com sucesso.'
          : 'Aguardando um novo QR Code…';
      }
    } catch {
      clearTimeout(expiryTimer);
      clearCode();
      badge.textContent = 'Bot indisponível';
      help.textContent = 'Não foi possível consultar a conexão do WhatsApp agora.';
      message.textContent = 'Tentando novamente…';
    } finally {
      clearTimeout(retryTimer);
      if (isLocal || panelSecret) retryTimer = setTimeout(update, 2000);
    }
  }

  update();
})();
