# Convites de clientes

Em **Clientes e pets**, use **Convidar para o portal** no cliente oficial da loja.
Confira nome e e-mail no diálogo e confirme o envio. O destinatário é consultado
novamente no servidor; não é possível enviar o convite para um endereço alternativo.
O histórico permite acompanhar aceite pelo provedor, ativação, expiração e revogação.
Não há disparo em massa nem envio automático ao publicar o código.

## Configurar em produção

1. Aplicar a migração `20260923120000_client_invitations` no banco do Hub, pelo
   procedimento de migração usado no ambiente. Ela adiciona somente a tabela
   `ClientInvitation` e índices; não modifica o banco do ERP. Não executar reset.
   Em uma base antiga sem histórico Prisma inicializado, revisar a baseline antes
   de executar `prisma migrate deploy`; não aplicar todas as migrações às cegas.
2. Configurar `RESEND_API_KEY` e `INVITATION_EMAIL_FROM` (remetente de domínio
   verificado no Resend). Exemplo de formato: `Matilha Prado <convites@matilhaprado.com.br>`.
   Para receber respostas no Gmail da loja, configurar
   `INVITATION_EMAIL_REPLY_TO=matilhaprado@gmail.com`.
3. Configurar `APP_URL=https://www.matilhaprado.com.br`.
4. Manter `INTEGRATION_BRIDGE_URL` e `INTEGRATION_BRIDGE_SECRET` configurados:
   o servidor verifica o cadastro oficial antes de enviar e de ativar.
5. Publicar e testar primeiro com um cadastro de teste controlado pela loja,
   incluindo recebimento do e-mail, criação da senha, login e exibição dos pets.
   Desativar rastreamento de cliques para estes e-mails de autenticação no provedor.

O provedor aceitar o envio não garante entrega. Devoluções e spam devem ser
conferidos no Resend. Em timeout, o histórico mostra “Envio não confirmado”:
verifique o provedor antes de reenviar. Um novo envio invalida o link anterior.

## Proteções e limites

- Token aleatório de 32 bytes; apenas SHA-256 no banco; validade de 48 horas.
- Token no fragmento da URL, retirado do endereço ao abrir; nenhum GET ativa conta.
- Uso único consumido na mesma transação da criação de usuário e cliente local.
- Papel CLIENTE e vínculo ERP definidos pelo servidor. Senha protegida por bcrypt.
- O uso bem-sucedido (`usedAt`) registra a confirmação do e-mail pelo convite.
- Não altera contas existentes, mesmo desativadas, nem associa cadastros locais
  antigos somente pela coincidência de e-mail. Conflitos precisam de revisão da loja.
- Clientes sem e-mail válido ou inativos não recebem convite.
- Limite de 30 tentativas por administrador/hora e intervalo de um minuto por cliente.
- Não implementa recuperação de senha nem migração de contas existentes.

Testes de transação/concorrência: `bun test tests/client-invitations.test.ts`,
exclusivamente com `DATABASE_URL` apontando para `matilha_auth_test`. O workflow
Client invitation checks usa PostgreSQL isolado e simula envio sem e-mails reais.
