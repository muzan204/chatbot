# Alterações

## 1.2.0 — 16/09/2026

- Histórico Git consolidado na raiz, com backup ZIP da cópia antiga.
- Filas separadas para sessão, credenciais e comandos; concorrência limitada por conversa.
- Reconexão ignora eventos de sockets antigos e não agenda tentativas duplicadas.
- Banco com validação interna, compatibilidade com campos ausentes, backup automático e recuperação.
- Gravação agrupada de contadores; encerramento aguarda trabalhos antes de salvar e fechar.
- Menos consultas de participantes, mantendo permissões atualizadas para moderação e comandos.
- Pino atualizado para 10.3.1 e Sharp para 0.35.4. Baileys mantido em 7.0.0-rc14, versão latest consultada no npm.
- Painel corrige estado indisponível, orienta quando o bot está desativado e oferece instalação em domínio externo.
- Fontes de fallback corrigidas; versão e documentação pública sincronizadas por script.
- Docker Compose com volumes persistentes e porta publicada apenas em loopback.
- Endpoint de prontidão, cabeçalhos de segurança e empacotamento Discloud por lista de arquivos permitidos.
- Testes ampliados de 11 para 24; configuração de CI para Node 22 e 24.

Esta versão foi validada localmente. Pareamento real, provedores externos, FFmpeg e execução na hospedagem dependem de validação no ambiente de destino.
