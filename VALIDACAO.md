# Validação local — 08/09/2026

- Dependências instaladas e travadas em `package-lock.json`.
- Sintaxe dos arquivos validada com `npm run check`.
- 10 testes passaram com `node --test --experimental-test-isolation=none`.
- Testes verificam regras de permissão, cooldown, calculadora, links, identidades PN/LID, persistência, XP, Express, moderação simulada, WebP/EXIF e falhas de serviços externos.
- O test runner com isolamento padrão foi bloqueado com `spawn EPERM` neste ambiente; a execução sem subprocesso passou.
- Node local: 22.17.1. npm local: 12.0.2, que emite aviso de incompatibilidade; recomenda-se Node LTS atualizado e seu npm correspondente.
- Não houve autenticação em WhatsApp, alterações em grupos reais, chamadas pagas de IA ou publicação em hospedagem.
- FFmpeg não disponível localmente: conversão de vídeo implementada, mas ainda precisa de teste em ambiente com FFmpeg. Dockerfile inclui essa dependência.
- Context7 recusou a chave configurada. Foram consultadas fontes oficiais e os tipos do Baileys instalado; referências no README.
