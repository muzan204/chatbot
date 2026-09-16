# Validação local — 16/09/2026 — versão 1.2.0

## Integração com origin/main

- Merge do tema roxo, painel remoto com PANEL_SECRET, configuração de host e mensagens da própria conta.
- 27 testes passaram com `npm run test:portable` após a resolução.
- Novos cenários: token do painel remoto, comandos da própria conta e filtro de mensagens append antigas.
- Proteções locais de origem e endereço preservadas; formulário remoto usa CSS externo compatível com a política de segurança.

## Validação anterior à integração

- Node.js 22.23.2.
- 24 testes passaram com `npm test` fora da restrição de subprocessos.
- Os mesmos 24 testes passaram com `npm run test:portable` no ambiente restrito.
- `npm run check` valida src, test, public e scripts.
- Auditoria online npm após a atualização: zero vulnerabilidades reportadas.
- `npm outdated --json` retornou `{}`: nenhuma dependência direta desatualizada no registro consultado.
- Pino 10.3.1 e Sharp 0.35.4 instalados; Baileys 7.0.0-rc14 mantido como latest consultado.
- Testes cobrem fila cheia, ordenação por conversa, progresso entre conversas, credenciais durante comando lento, reconexão, desconexão permanente, encerramento, backup, corrupção, gravação agrupada, permissões, anti-link, painel, QR, APIs HTTP, calculadora e WebP.
- Banco existente validado em modo somente leitura. Sessão e dados reais não foram modificados.
- Servidor iniciado com WhatsApp desativado e banco temporário: página, CSS, JavaScript e autenticação local responderam 200; prontidão respondeu 503, como esperado sem conexão.
- Navegador de automação indisponível: comportamento do painel testado com DOM simulado; aparência e responsividade ainda não verificadas visualmente.
- FFmpeg não está no PATH: conversão real de vídeo continua pendente.
- Não houve pareamento real, envio a grupos, chamadas pagas de IA ou publicação na hospedagem.
- Docker/Compose e matriz de CI foram configurados, mas não executados neste ambiente.
- Histórico Git preservado na raiz; cópia anterior arquivada em artifacts/chatbot-original-20260916.zip.
- Pacote Discloud gerado por lista explícita, sem .env, auth ou data.

## Documentação consultada

Context7 conectado via Apps forneceu documentação de Baileys, Sharp e Pino. A outra conexão Context7 recusou sua chave; o conector alternativo funcionou.

- https://github.com/WhiskeySockets/Baileys
- https://github.com/lovell/sharp/blob/main/docs/src/content/docs/changelog/v0.35.0.md
- https://github.com/pinojs/pino/blob/main/docs/lts.md

Não há garantia de funcionamento na cota de 100 MB da Discloud; medir consumo e persistência no ambiente real permanece necessário.
