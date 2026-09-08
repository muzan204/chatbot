# 🌙 OS NOTURNOS — Site + Bot

Um único projeto. Um único `npm start`.

## Iniciar

Abra **esta pasta** no VS Code. Na primeira instalação:

```sh
npm install
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

O QR fica em memória, não aparece nos logs e só é fornecido pelo endpoint local `/api/auth`. Acesso por domínio externo, origem externa e rede externa é recusado. `auth/` contém as credenciais da sessão: preserve essa pasta e não a publique. O site hospedado anteriormente não recebe o QR local.

## Resolver problemas

- **Porta 3000 ocupada:** pare a instância anterior antes de rodar `npm start` novamente.
- **Navegador não abriu:** acesse manualmente http://127.0.0.1:3000/#conectar.
- **QR aguardando:** confira o terminal e a conexão com a internet; ele pode levar alguns segundos para ser gerado.
- **Bot não responde:** envie de outra conta e verifique o prefixo do grupo.
- **Sessão encerrada:** verifique se outra instância está usando a mesma conta antes de refazer o pareamento.
- **PowerShell bloqueia npm.ps1:** use `npm.cmd start`.

Testes: `npm test`. Em ambientes que bloqueiam subprocessos: `node --test --experimental-test-isolation=none`.

O bot usa Baileys, uma integração comunitária sem afiliação oficial com o WhatsApp. A conexão real depende do pareamento no celular. APIs e vídeos devem ser testados no ambiente configurado.
