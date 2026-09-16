# Integração da agenda

Conta de teste autorizada: **pedrosolopes.tiago@gmail.com**. Após os testes, definir BOOKING_OWNER_EMAIL=fudinori1968@gmail.com na Vercel, fazer novo deploy e solicitar nova autorização ao Alberto pelo link de conexão. Tokens e reservas são separados por conta; eventos de teste não são transferidos. O projeto Google Cloud pode ser administrado pelo desenvolvedor, independentemente da conta de agenda autorizada.

## Estado

A integração só funciona após configurar as variáveis na Vercel e concluir o OAuth. Sem isso, as APIs retornam indisponibilidade e o site encaminha ao WhatsApp. Nunca confirmar um agendamento apenas no navegador.

## Google Cloud

1. Entrar na conta de teste e criar um projeto para O Corpo Responde.
2. Ativar **Google Calendar API**.
3. Configurar Google Auth Platform: nome do aplicativo, e-mail de suporte, público **External** e contato do desenvolvedor.
4. Configurar os escopos `openid`, `email`, `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/calendar.freebusy`.
5. Criar cliente OAuth do tipo **Web application**, com redirect URI exata:
   `https://ocorporesponde.vercel.app/api/oauth?action=callback`
6. Cadastrar a conta do analista como test user durante desenvolvimento. Para operação contínua, publicar o aplicativo em produção e avaliar a exigência de verificação ou exceção de uso pessoal. Tokens emitidos em Testing para estes escopos expiram em sete dias: reconectar após mudar o status.

Não enviar senha, client secret ou tokens por chat, nem incluir no Git.

## Persistência e Vercel

Conectar um banco Upstash Redis REST ao projeto Vercel. Ele guarda o refresh token cifrado, estados OAuth temporários, limitação de tentativas e reservas atômicas. Verificar limites e condições do plano antes da contratação.

Configurar em **Production**, sem prefixos públicos:

| Variável | Conteúdo |
| --- | --- |
| BOOKING_OWNER_EMAIL | pedrosolopes.tiago@gmail.com durante os testes; depois fudinori1968@gmail.com |
| GOOGLE_CLIENT_ID | Cliente OAuth criado no Google Cloud |
| GOOGLE_CLIENT_SECRET | Segredo desse cliente |
| BOOKING_ADMIN_SECRET | Código aleatório com pelo menos 32 caracteres para iniciar a conexão |
| BOOKING_ENCRYPTION_KEY | 32 bytes aleatórios codificados em base64 |
| UPSTASH_REDIS_REST_URL | URL REST do banco |
| UPSTASH_REDIS_REST_TOKEN | Credencial REST do banco |

Gerar os segredos localmente e armazenar diretamente no gerenciador de segredos/Vercel. Não registrar valores em logs. A chave de criptografia precisa ser preservada; alterá-la exige reconectar a conta.

Fazer novo deploy após configurar as variáveis. Abrir `/conectar-agenda.html`, inserir o código administrativo e autorizar a conta do analista no Google. A API recusa outras contas. O código administrativo não é a senha Google.

## Regras atuais a confirmar com o analista

- Sessão: 90 minutos; fuso America/Sao_Paulo.
- Segunda a sábado, das 08h às 22h (Brasília). Sessões de 90 minutos: 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00 e 22:00; último término às 23:30.
- Antecedência mínima: 2 horas; horizonte: 90 dias.
- Reserva automática; convite por e-mail ao cliente.
- Horários fixos sem sobreposição. Se mudar a grade ou duração para permitir sobreposição, substituir a reserva por slot por transação que proteja intervalos.
- Sem geração automática de Meet nesta etapa.
- Cancelamentos devem ser feitos com o analista. Não há sincronização de cancelamento para reabrir o slot Redis nem consulta autenticada de reservas por e-mail nesta etapa; liberar o registro do slot somente após verificar o cancelamento no Google.

Eventos externos são consultados antes da gravação. Edições manuais no Calendar simultâneas ao último instante da confirmação ainda podem gerar conflito externo; o bloqueio atômico cobre solicitações deste site.

## Falhas e operação

Uma resposta incerta do Google mantém o slot reservado para evitar duplicidade. O cliente pode repetir a confirmação com os mesmos dados; o servidor reconcilia pelo ID do evento. Se não houver evento, o administrador deve verificar a agenda antes de liberar `ocr:reservation:DATA:HORA`. Não apagar registros sem confirmar a situação.

O histórico no navegador mostra apenas confirmações locais, não o estado atualizado de cancelamentos. Convites por e-mail e a agenda do analista são a referência.

## Validação antes de ativar

Executar `npm test`. Com credenciais reais, autorizar a conta e testar leitura de disponibilidade; depois, com autorização do cliente, efetuar uma reserva de teste e confirmar evento, destinatário e horário. Cancelar o teste e liberar seu slot. Não anunciar a integração como ativa antes dessa verificação real.

Referências: [OAuth Web Server](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference), [Vercel environment variables](https://vercel.com/docs/environment-variables).
