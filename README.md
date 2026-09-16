# 🌙 OS NOTURNOS — Site + Bot

Um único projeto. Um único `npm start`.

## Iniciar

Abra **esta pasta** no VS Code. Na primeira instalação:

```sh
npm ci
```

Depois:

```sh
npm start
```

O comando inicia o bot e o site no mesmo servidor e abre o navegador em **http://127.0.0.1:3000/#conectar**. Não precisa compilar o site, abrir outra pasta ou iniciar um segundo servidor.

No celular, abra **WhatsApp → Aparelhos conectados → Conectar um aparelho** e escaneie o QR dentro do site. Ele é atualizado automaticamente e desaparece após conectar. Envie `!menu` de outra conta para testar.

Deixe o terminal aberto. Pare com Ctrl+C antes de iniciar outra instância. No VS Code, Ctrl+Shift+B executa a mesma tarefa. F5 permite depurar o bot.

## Configuração

O `.env` já está preparado na instalação local. Em uma cópia nova sem esse arquivo, o padrão também funciona: o site está em `public/`, a porta é 3000, o navegador abre automaticamente e o bot usa QR Code. Copie `.env.example` para `.env` quando quiser personalizar.

```env
HOST=127.0.0.1
PORT=3000
SITE_DIR=./public
OPEN_BROWSER=true
WHATSAPP_ENABLED=true
AUTH_MODE=qr
PREFIX=!
```

Use `OPEN_BROWSER=false` para iniciar sem abrir o navegador. IA, clima, tradução e encurtador continuam opcionais e exigem a configuração das respectivas APIs. FFmpeg é necessário para figurinhas de vídeos. Node.js 22 atualizado ou 24 LTS é recomendado.

## Pastas

```text
os-noturnos-whatsapp/
├── public/
│   ├── index.html       # Site pronto e editável
│   ├── styles.css       # Aparência
│   ├── local-panel.js   # QR e estado da conexão
│   └── downloads/       # Documentação
├── src/
│   ├── commands/        # Comandos por categoria
│   ├── events/          # Mensagens e participantes
│   ├── services/        # Site, conexão, IA e figurinhas
│   ├── database/        # Persistência
│   └── index.js         # Inicia site e bot juntos
├── auth/                # Sessão WhatsApp; não compartilhar
├── data/                # Configurações, avisos e XP
├── test/
├── .vscode/
├── .env.example
├── package.json
└── package-lock.json
```

Edite o site diretamente em `public/` e atualize a página. Não há dependência da pasta antiga `os-noturnos-site`.

## Comandos principais

- Menu e informações: `!menu`, `!ajuda`, `!ping`, `!bot`, `!info`, `!criador`, `!perfil`, `!status`, `!uptime`.
- Utilidades: `!calculadora 2*(3+4)`, `!clima São Paulo`, `!traduzir en Olá`, `!qr texto`, `!link número-internacional`, `!encurtar https://example.com`, `!cep 01001000`, `!data`, `!hora`.
- Figurinhas: responda à imagem ou vídeo curto com `!s` ou `!sticker`.
- IA: `!ia pergunta`, `!ai pergunta`, `!pergunta texto`.
- Grupo: `!grupo`, `!regras`, `!admins`, `!abrir`, `!fechar`, `!linkgrupo`, `!marcar texto`, `!marcartodos texto`.
- Moderação: `!ban @membro`, `!kick @membro`, `!promover @membro`, `!rebaixar @membro`, `!mute @membro 10`, `!unmute @membro`, `!advertir @membro motivo`, `!avisos @membro`, `!limparavisos @membro`.
- Configurações: `!antilink on`, `!welcome on`, `!despedida on`, `!xp on`, `!iagrupo on`, `!prefixo /`. Use `off` para desativar.
- Diversão: `!dado`, `!moeda`, `!numero 1 100`, `!ship Ana e João`, `!quiz`, `!quiz resposta`, `!piada`, `!verdade`, `!desafio`, `!rank`, `!ranking`, `!nivel`.

Ações administrativas exigem permissões do remetente e, quando necessário, do bot. O mute individual apaga mensagens durante o prazo; não altera uma permissão nativa individual. O XP tem cooldown para impedir ganho por spam.

## QR e sessão

No modo local padrão, o QR fica em memória e não aparece nos logs. O endpoint `/api/auth` verifica endereço de loopback, domínio e origem para acesso local sem senha. No site hospedado, configure `PANEL_SECRET` com uma chave longa e exclusiva e informe-a no formulário do painel, usando HTTPS. Sem essa configuração, o QR remoto não é disponibilizado. A chave é enviada no cabeçalho Authorization e guardada na sessão da aba após autenticação. Docker e Discloud também podem usar o console privado para pareamento. `auth/` contém as credenciais da sessão: preserve essa pasta e não a publique.

No Render, o servidor escuta em `0.0.0.0` automaticamente e não abre navegador. Comandos enviados pela própria conta conectada também são aceitos; respostas comuns do bot são ignoradas para evitar loops. Mensagens `append` só são processadas quando possuem timestamp recente (até 120 segundos).

## Resolver problemas

- **Porta 3000 ocupada:** pare a instância anterior antes de rodar `npm start` novamente.
- **Navegador não abriu:** acesse manualmente http://127.0.0.1:3000/#conectar.
- **QR aguardando:** confira o terminal e a conexão com a internet; ele pode levar alguns segundos para ser gerado.
- **Bot não responde:** envie de outra conta e verifique o prefixo do grupo.
- **Sessão encerrada:** verifique se outra instância está usando a mesma conta antes de refazer o pareamento.
- **PowerShell bloqueia npm.ps1:** use `npm.cmd start`.

Testes: `npm test`. Em ambientes que bloqueiam subprocessos: `npm run test:portable`.

## Versão 1.2.0 — operação e manutenção

A raiz é a única pasta de desenvolvimento. O histórico Git foi preservado aqui.
A antiga pasta `chatbot/` foi arquivada em `artifacts/chatbot-original-20260916.zip`.
Não edite nem execute o backup; ele serve apenas para recuperação.

- Comandos são ordenados por conversa, com até 4 conversas em paralelo. Ajuste `COMMAND_CONCURRENCY` entre 1 e 16.
- Há limite de 200 trabalhos no total e 50 por conversa. Quando a fila está cheia, novos trabalhos são descartados com o evento `queue.full` no log.
- Eventos de conexão e gravação de credenciais usam filas próprias e não são descartados pela fila de comandos.
- Mensagens comuns com identidade LID não consultam participantes. Comandos e possíveis ações de moderação consultam permissões atuais.
- Contadores de mensagens e XP são salvos em lotes a cada `DATABASE_FLUSH_MS` (padrão: 2000 ms). Um encerramento abrupto pode perder esse intervalo; alterações administrativas aguardam gravação.
- `data/database.json.bak` mantém o último estado salvo antes da gravação atual. Na recuperação, o arquivo inválido é preservado como `.corrupt-...`. Mantenha também backups externos privados de `auth/` e `data/`.
- Execute apenas uma instância por sessão e banco. Não compartilhe os mesmos volumes entre réplicas.
- O encerramento aguarda trabalhos pendentes por até 150 segundos. Um limite menor imposto pela hospedagem pode interromper esse processo.
- `/health` informa que o servidor está vivo; `/ready` retorna 200 somente com WhatsApp conectado e sem falha de gravação de credenciais, ou 503 caso contrário.

## Docker

```sh
docker compose up --build -d
docker compose logs -f bot
```

O site fica em http://127.0.0.1:3000. O contêiner escuta em `0.0.0.0`,
mas a porta publicada fica restrita ao computador local. Os volumes nomeados
preservam sessão e banco entre reinicializações. Não use `down -v` se quiser preservá-los.

Por segurança, o endpoint de QR continua exigindo conexão de loopback.
A rede do Docker pode fazer esse endpoint retornar 403: nesse caso, use o QR
do console privado (`AUTH_CONSOLE=true` no contêiner). Não exponha esses logs.
No uso local, `AUTH_CONSOLE` permanece desativado por padrão.
Para APIs opcionais, adicione as variáveis ao ambiente do serviço; o `.env` local
não é copiado para a imagem e não é injetado automaticamente pelo Compose.

## Validação e pacote de hospedagem

```sh
npm run check
npm test
npm run sync:public
```

No Windows, `npm run package:discloud` gera `artifacts/os-noturnos-discloud.zip`
a partir de uma lista explícita de arquivos, sem chaves, banco ou sessão.
Execute os testes antes de gerar o pacote. Consulte [DISCLOUD.md](DISCLOUD.md).
O script `sync:public` atualiza a versão do site e as cópias da documentação para download.
O pacote para Discloud contém apenas o bot; os scripts de desenvolvimento pertencem ao checkout completo.

O bot usa Baileys, uma integração comunitária sem afiliação oficial com o WhatsApp. A conexão real depende do pareamento no celular. APIs e vídeos devem ser testados no ambiente configurado.
