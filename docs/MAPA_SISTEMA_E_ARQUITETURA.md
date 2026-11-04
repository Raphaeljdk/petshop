# Inventário funcional e arquitetura — Matilha Prado
**Base:** árvore de arquivos e documentos da branch `main` examinados em 04/11/2026.
**Legenda:** **Localizado no código** = há componente, rota ou modelo. Não implica operação verificada em produção.

## Visão técnica
- Web: Next.js 16, React 19, TypeScript, Tailwind CSS; UI cliente e administrativa.
- Persistência própria: PostgreSQL via Prisma; projeto contém `prisma/schema.prisma` e migrações.
- Implantação prevista: Vercel; integrações externas via backend e variáveis de ambiente.
- Controles de acesso: `src/app/api/auth/*`, `src/lib/auth-*`, usuários e convites administrativos/de clientes.
- Diretórios principais: `src/app/api` (rotas), `src/components` (interfaces), `src/lib` (regras/integrações), `prisma` (modelo/migrações), `tests` (testes), `docs` (documentação).

## Inventário por módulo
| Domínio | Evidência de implementação localizada | Escopo / atenção |
| --- | --- | --- |
| Site e vitrine | `src/components/landing/*`, `src/app/page.tsx`, `api/public/produtos`, `api/public/avaliacoes`, `api/public/google-reviews` | Serviços, produtos e avaliações: verificar dependências externas |
| Login, cadastro, convites | `api/auth/*`, `api/admin/convites*`, `src/components/auth/*` | Não confundir convite de administrador com convite de cliente; observar permissões |
| Administração | `src/components/admin/AdminPanel.tsx`, `src/components/layout/Sidebar.tsx` | Visão agregadora; inventário detalhado na UI deve ser revalidado |
| Clientes e pets | `api/clientes/*`, `api/pets/*`, `api/cliente/pets/*`, `src/components/clientes/*` | Fonte oficial Siggma/Zetta pode impor limitação de escrita |
| Portal do cliente | `src/components/cliente-portal/*`, `api/cliente/*` | Compras, carrinho, perfil, preferências, vacinas, avaliações e fidelidade |
| Produtos e loja | `api/produtos/*`, `api/cliente/produtos`, `src/components/ecommerce/*` | Estoque e preço precisam ser verificados na fonte apropriada |
| Vendas, entrega e checkout | `api/vendas/*`, `api/pagamento/*`, `src/components/cliente-portal/PagamentoCheckout.tsx` | Webhook e idempotência exigem teste real |
| Agenda e serviços | `api/agendamentos/*`, `api/cliente/agendamentos/*`, `api/admin/agenda/servicos`, `src/components/agendamentos/*` | Diferenciar solicitação local de confirmação oficial no ERP |
| Kanban diário | `src/components/agenda/daily-appointment-kanban.tsx`, `src/components/kanban/KanbanBoard.tsx` | Presença de componentes não comprova integração, persistência ou publicação |
| Dashboard | `api/dashboard/*`, `api/admin/vendas-resumo`, `src/components/dashboard/*` | Receita do Hub e notas emitidas por marketplaces podem ter fontes diferentes |
| Relacionamento | `api/admin/relacionamento`, `api/cliente/fidelidade`, `api/cliente/avaliacoes` | Fidelidade depende de configuração explícita |
| Cupons e notificações | `api/admin/cupons`, `api/cupons/validar`, `api/notificacoes`, `api/cliente/preferencias` | Diferenciar avisos no portal de envio externo |
| Frete | `api/frete/*`, `api/integracoes/melhor-envio/*` | Cotação pode falhar por configuração/regra da transportadora |
| Marketplaces | `api/integracoes/mercado-livre/*`, `api/integracoes/amazon/*`, `api/integracoes/marketplaces/vendas/sincronizar` | Validar sincronização, deduplicação e estoque por SKU |
| Integração ERP antigo | `api/admin/siggma/*`, `api/admin/zetta/*`, `src/lib/integration-bridge.ts` | Documentação histórica pode descrever uma arquitetura anterior |
| Fiscal | `api/admin/fiscal/*`, `src/lib/fiscal-*.ts`, `src/components/admin/FiscalView.tsx` | Prévia/rascunho não equivalem à NF-e autorizada pela SEFAZ |
| Exportação | `api/export`, `src/components/ui/ExportButton.tsx` | Conferir formatos e limites |
| PWA | `src/components/pwa/*` | Verificar disponibilidade e instalação em dispositivos reais |

## Modelo de dados
Modelos Prisma encontrados: `User`, `Cliente`, `Pet`, `Processo`, `Agendamento`, `ProfissionalAgenda`, `Produto`, `Venda`, `ItemVenda`, `Cupom`, `CupomUso`, `Notificacao`, `Integracao`, `MercadoLivreConnection`, `ConfiguracaoFrete`, `ConfiguracaoPagamento`, `AdminInvitation`, `AuthAttempt`, `ClientInvitation`, `CustomerPreference`, `CustomerPetProfile`, `ProductReview`, `BookingRequest`, `LoyaltyConfig`, `LoyaltyRedemption`, `ConfiguracaoFiscal`, `NotaFiscal`, `AgendaEvento`, `RegraFiscalAprovada`, `ImportacaoFiscalProduto`, `ServicoEsteticoConfig`.

O schema Prisma é a referência do formato atual dos dados, sujeito à confirmação das migrações efetivamente aplicadas no banco de produção.

## Fluxos de alto nível
1. Cliente: landing → login/cadastro → portal → catálogo/carrinho → cotação → pagamento → acompanhamento.
2. Pet e agenda: cadastro/vínculo → seleção de serviço → solicitação → confirmação pela operação conforme integração autorizada → histórico.
3. Marketplace: autenticação externa → importação/sincronização → associação de produto/SKU → venda/documento fiscal → dashboard; verificar reconciliação.
4. Fiscal: cadastro do emitente e produto → regra revisada e aprovada → validação → prévia XML → homologação com assinatura e protocolo → decisão específica de produção.
5. Administração: painel → cadastros/produtos/agendamentos/vendas/financeiro/fiscal/relatórios; conferir permissões por papel.

## Segurança e dados
- Tokens/segredos/certificado A1 devem permanecer em ambiente seguro, nunca no frontend ou neste repositório.
- Não registrar CPF, e-mail de clientes, XML fiscal real ou conteúdo de certificados em documentação pública.
- Integridade referencial, permissões por titular e autenticação devem ser verificadas nos endpoints, não apenas na UI.
- Operações de importação e sincronização devem ser repetíveis/idempotentes e auditáveis.
