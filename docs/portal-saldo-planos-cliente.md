# Saldo de planos de banho e cuidados no portal do cliente

Atualização: 19/11/2026.

## Tela inicial
- Quando o cliente possui plano com pagamento/aprovação registrada, **Início** apresenta **Meus planos de banho e cuidados** abaixo de **O próximo cuidado**.
- Por plano: nome, descrição, pet, total de sessões contratadas, sessões utilizadas, sessões disponíveis, barra de progresso, prazo de validade e situação.
- Cada solicitação de plano é isolada pelo `clienteId` autenticado. Solicitações ainda não pagas **não** aparecem como planos comprados.
- Se não existir plano adquirido, não aparece um cartão artificial ou contador fictício.

## Meus Pets > Planos de banho e cuidados
- Mostra progresso do plano do pet selecionado, além de solicitações pendentes e das opções de assinatura existentes.
- Planos vencidos/cancelados podem mostrar sessões históricas não utilizadas, mas suas **sessões disponíveis serão zero**.
- Planos com todas as sessões utilizadas aparecem como concluídos.
- O nome/descrição informa os cuidados previstos. O cadastro atual controla um **total de sessões por plano**, não uma lista individual de procedimentos pendentes.

## Origem dos dados
- `PortalCarePlanRequest.sessionsUsed` é incrementado no fluxo administrativo `plan-use` após um atendimento concluído ser conferido e vinculado ao pacote.
- `PortalCarePlan.sessions` define o total; o saldo exibido resulta dessas contagens, não de agendamentos futuros ou compras da loja.
- A API `GET /api/cliente/dashboard` retorna somente registros `ativo` ou `cancelado` com `approvedAt` preenchido para o cliente logado.
- O resumo é calculado em `src/lib/portal-care-plan-summary.ts` e compartilhado com os componentes cliente.
- A liberação de saldo não muda as regras de cobrança nem ativa assinaturas automaticamente.

## Validação
- `bun test tests/portal-care-plan-summary.test.ts`
- `npx tsc --noEmit` e build/CI do GitHub.
- Homologar com plano manual realmente aprovado, pet cadastrado, uso confirmado pelo gestor e teste de expiração/cancelamento.
