# Matilha Prado — mudança segura para Neon Launch

## Situação
O sistema já usa PostgreSQL com Prisma e está em produção na Vercel.
**Não substitua DATABASE_URL por uma conexão de banco vazio.** O serviço atual contém usuários, produtos, pedidos e registros fiscais. A migração de cliente/pet legado do Zetta é um trabalho independente.

## Responsabilidades e custos
- O proprietário da loja deve escolher a conta Neon, ativar o plano **Launch** e configurar o método de pagamento.
- Neon Launch cobra por consumo de compute, armazenamento, histórico/backups e recursos adicionais; consulte a tabela vigente em https://neon.com/pricing antes de contratar.
- A API do Neon não confirma nem paga uma assinatura em nome do usuário. Este PR **não** cria nova base na conta do usuário nem altera variáveis de produção.
- Monitorar conexões, custo, tempo de CPU e avisos de gastos.

## Provisionamento sugerido
1. Em https://console.neon.tech, selecionar a conta correta e criar projeto **matilha-prado-erp** em região próxima à hospedagem do servidor Next.js. Escolher a região pela latência medida; os servidores Vercel atuais podem estar em iad1 (EUA).
2. Ativar Launch, habilitar proteção por backup/restore conforme o plano contratado, alertas e pelo menos uma branch de QA. Conferir a janela real de histórico disponível no console.
3. Obter **pooled connection string** para a aplicação (`DATABASE_URL`) e **direct connection string** para migrations (`DIRECT_URL`). Guardar apenas no gerenciador de segredos, jamais em GitHub ou chat.
4. Fazer exportação consistente do banco atual, **antes** de tocar nos ambientes. Exemplo, em ambiente seguro (com acesso autorizado):
   ```bash
   pg_dump --format=custom --no-owner --no-privileges --file=matilha-backup.dump "$DATABASE_URL_ANTIGA"
   ```
   Proteger o arquivo e conferir tamanho, checksums e capacidade de restauração.
5. Restaurar no banco novo isolado e validar o resultado:
   ```bash
   pg_restore --no-owner --no-privileges --dbname="$DIRECT_URL_NOVA" matilha-backup.dump
   ```
   NÃO usar `--clean` em base com dados existentes sem planejar restauração completa.
6. Conferir contagens de tabelas, autenticação, usuários, clientes/pets, estoque por SKU/variação, vendas, notas e pagamentos. Validar CHECKSUM/IDs, vínculos e chaves externas.
7. Configurar banco novo primeiro em **Preview/QA** na Vercel; testar site, Kanban, agenda, fiscal (rascunhos), checkout, webhooks e marketplace. Não usar integrações de cobrança/emissão reais em QA.
8. Para migração definitiva de produção: escolher janela de manutenção, interromper escrita de novas vendas temporariamente, fazer backup final e copiar diferenças posteriores ao teste. Trocar secrets `DATABASE_URL` e `DIRECT_URL` na Vercel, publicar, validar APIs e reabrir vendas.
9. Manter banco antigo preservado para rollback até confirmar contagem e reconciliação de pedidos pagos (incluindo webhooks recebidos na janela de migração).
10. Nunca tratar o Neon como substituto de armazenamento de XML, DANFE, PDF ou imagens em grande volume: usar object storage privado, com política de retenção e backup.

## Prisma
Somente **depois** de adicionar DIRECT_URL no ambiente, configurar:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
Para banco restaurado já com tabela `_prisma_migrations`, evitar aplicar as mesmas alterações manualmente por SQL. Se criar banco vazio para testes:
```bash
npx prisma migrate deploy
```
**Não** executar `prisma migrate reset`, `db push --force-reset` ou `migrate dev` em produção.

## Migração de clientes/pets do Zetta
A ponte de produção já foi desligada. Para recuperar cadastros históricos, pedir **exportação autorizada** em JSON/CSV ao dono da conta antiga e normalizar para `docs/importacao-clientes-pets-zetta.md`. A importação por `scripts/importar-zetta-clientes-pets.mjs` roda inicialmente em modo simulação, apontando para banco QA, e bloqueia colisões de e-mail/documento. Não reativar secrets da ponte para consultar sistema terceiro sem credenciais e consentimento válidos.

## Emissão fiscal
A geração automática de rascunhos não é emissão de NF-e válida. O provedor homologado (a selecionar com contador), certificado e acesso fiscal precisam ser configurados antes de liberar o envio, XML/DANFE e cancelamento real. A fila fiscal deve ser persistente e idempotente sob alto volume.
