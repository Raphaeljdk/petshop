# Login operacional e bloqueio de agendas — Matilha Prado

## Contas autorizadas
- André: `andreflavieira21@gmail.com`
- Aleksander: `aleksanderprado97@icloud.com`

A administração gera um convite individual por e-mail em **Equipe e convites**. O profissional abre `/ativar-equipe`, utiliza o código e escolhe a própria senha. O servidor atribui `KANBAN`, nunca `ADMIN`. Nenhuma conta ou senha é criada automaticamente sem o convite e a ativação.

## Permissões e bloqueios
- Ambos consultam o Kanban e a agenda, agendam banhos vinculados ao seu profissional e consultam endereços de entregas em aberto.
- Dentro de **Banhos e agendamentos**, cada um cria bloqueio informando início, fim e motivo e pode liberar apenas os seus próprios horários.
- Para o outro funcionário, o horário aparece indisponível sem revelar o motivo; ADMIN visualiza os bloqueios.
- A criação de bloqueios rejeita intervalos que já contêm agendamentos ativos daquele profissional. A criação e remarcação de agendamentos verificam bloqueios no servidor.
- A agenda administrativa exige escolher um profissional para a verificação do bloqueio; agendamentos antigos sem atribuição não são alterados.
- Limitação atual: a validação compara os horários de início, pois `Agendamento` não armazena a duração do serviço.
- Não há acesso desses operadores a vendas, dados fiscais, configurações, ou relatórios de faturamento.
- Verificar casos de dois bloqueios simultâneos, horários contíguos, dois usuários, alteração por ADMIN e recusa de um outro perfil KANBAN.

## Publicação
Aplicar `prisma migrate deploy` e `prisma generate` no banco correto antes de publicar o código. Executar `bun test tests/operational-access.test.ts tests/agenda-bloqueios.test.ts`, `bun run typecheck`, `bun run lint` e homologar convites dos dois e-mails. Não ativar o recurso em produção sem esses testes.
