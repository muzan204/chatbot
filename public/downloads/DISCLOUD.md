# Hospedar apenas o bot na Discloud

O arquivo `discloud.config` inicia `src/discloud.js`, sem site ou porta HTTP.
O plano Free tem 100 MB de RAM: a compatibilidade do projeto completo ainda
precisa ser testada na hospedagem, especialmente ao criar figurinhas.
O reinicio automatico da plataforma exige plano pago e esta desativado.

## Primeiro envio

Na pasta principal, valide com `npm run check` e `npm test` (ou
`npm run test:portable` em ambientes restritos). No Windows, gere o pacote
atualizado com `npm run package:discloud`. Não reutilize um ZIP antigo após editar o código.

1. Entre em https://discloud.com/dashboard com sua conta.
2. Escolha **+ Upload**, depois **Upload ZIP**, e envie
   `artifacts/os-noturnos-discloud.zip`.
3. Abra o console/logs privados da aplicacao. No WhatsApp do celular, entre em
   **Aparelhos conectados > Conectar um aparelho** e escaneie o QR do console.
4. Aguarde `connection.open` nos logs e envie `!menu` de outra conta.

O ZIP nao inclui o `.env` local, chaves, sessao existente ou banco de dados.
O bot inicia com a configuracao padrao, sem as integracoes opcionais de IA,
clima e encurtador. As pastas `auth/` e `data/` sao criadas na hospedagem.
Nao apague essas pastas; faca backup privado antes de substituir a aplicacao.
Se migrar uma sessao existente, pare a instancia local antes de iniciar a remota.

## Se o QR nao ficar legivel

No arquivo `.env` da aplicacao hospedada, configure:

```env
AUTH_MODE=pairing
PAIRING_PHONE=SEU_NUMERO_COM_DDI_E_DDD_SOMENTE_DIGITOS
```

Reinicie o bot e use o codigo exibido no console privado na opcao de conectar
com numero de telefone do WhatsApp. Nunca compartilhe QR, codigo ou pasta auth.
O modo local (`npm start`) continua exibindo o pareamento somente no painel local.

O modo local só imprime pareamento quando `AUTH_CONSOLE=true` é definido explicitamente.
Na Discloud, o console privado é o canal de pareamento por padrão.
O encerramento tenta concluir a fila e persistir os dados em até 150 segundos;
o prazo real também depende do limite imposto pela hospedagem.

## Integracoes opcionais

Configure as variaveis necessarias no `.env` da hospedagem (use `.env.example`
como referencia). Para Gemini, o projeto le `AI_API_KEY`, nao `GEMINI_API_KEY`.
Nao publique esse arquivo. O pacote inicial funciona sem essas chaves.

## Verificacao na hospedagem

- Confirme Node.js 22.17 ou superior nos logs de instalacao.
- Confira o consumo de RAM no painel durante o pareamento e uso de figurinhas.
- Se exceder 100 MB, o plano Free nao comporta essa carga; nao ha garantia de
  operacao continua com todos os recursos nesse limite.
- Teste uma figurinha de video para confirmar que FFmpeg esta disponivel.
- Reinicie pelo painel e confirme que reconecta sem novo pareamento.

Documentacao: https://docs.discloud.com/configurations/discloud.config
e https://docs.discloud.com/how-to-host-using/dashboard
