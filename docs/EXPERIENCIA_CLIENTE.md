# Experiência do cliente — ativação e limites

## Entrega

| Recurso | Onde usar | Comportamento |
| --- | --- | --- |
| Comprar novamente | Cliente → Minhas Compras | Reconsulta preço/estoque do ERP, limita quantidades disponíveis, informa itens excluídos e abre carrinho para revisão. Não cria venda nem cobrança. |
| Favoritos | Loja → coração / Meus favoritos | Salvos na conta no Hub; não dependem do aparelho. |
| Agendamento fácil | Agenda → Agendar pelo portal | Quando expediente e catálogo de serviços estão configurados, cria diretamente pelo endpoint oficial do Siggma/Zetta. Enquanto essa configuração estiver incompleta, mantém a solicitação à equipe como fallback seguro. |
| Perfil do pet | Meus Pets → Personalizar perfil | Foto reduzida para até 640 px, porte, nascimento e cuidados. Complemento no Hub, sem sobrescrever dados do ERP. A edição de dados básicos de pets locais usa uma rota com verificação de proprietário. |
| Retirada/entrega | Carrinho | Custo e prazo antes do pagamento. Retirada começa pendente, não entregue. Prazo armazenado no pedido. |
| Reposição | Loja → Lembrar | Data futura; aviso dentro do portal e exportação .ics para o calendário do cliente. Não envia e-mail/push/WhatsApp automaticamente. |
| Fidelidade | Início → Clube Matilha / Admin → Relacionamento | Configuração explícita pela loja; sem configuração, nenhum ponto ou desconto é concedido. Resgate cria cupom pessoal de uso único. |
| Avaliações verificadas | Minhas Compras → expandir pedido → Avaliar | Backend verifica compra concluída. Nota, comentário e primeiro nome públicos nos detalhes do produto. Admin pode ocultar spam/conteúdo inadequado. |
| Avise quando chegar | Produto sem estoque | Aviso na área pessoal ao acessar o portal; estoque de produtos vinculados é reconsultado no ERP. Não é notificação externa automática. |
| Painel de vendas | Admin → Visão geral → Vendas e oportunidades | Receita sem frete, ticket médio, mais vendidos e estoque baixo. Apenas vendas concluídas registradas no Hub, não todo o faturamento do ERP. |

## Banco de dados

A migração `20260928010000_customer_experience` cria seis tabelas novas, índices e referências. Não altera colunas do ERP ou das tabelas existentes, nem remove registros. É aplicada **somente ao banco gravável do Hub**, nunca ao PostgreSQL somente leitura do Zetta.

Antes de publicar a ativação:

1. Confirmar projeto, branch e database de produção do Hub, comparando com a configuração do projeto Vercel `petshop`.
2. Usar uma branch isolada do banco e testar com dados representativos antes da produção; manter backup/snapshot conforme a política do projeto.
3. Usar conexão direta, não pooled, fornecida pelo ambiente seguro. Não colar segredos no chat ou no repositório.
4. Revisar `npx prisma migrate status` antes de executar `npx prisma migrate deploy`; este último pode aplicar **outras migrações pendentes** além desta. Não resolver/baselinear falhas antigas automaticamente.
5. Executar `npx prisma migrate deploy` somente após confirmar o banco e as migrações pendentes. Nenhuma migração é executada pelo build da Vercel.
6. Conferir favoritos com duas contas, edição de pet próprio, solicitação/confirmacão, avaliação verificada e resgate em ambiente de teste.

Enquanto faltam tabelas, os endpoints novos retornam `503 SETUP_REQUIRED`; controles correspondentes ficam indisponíveis, sem impedir a loja ou as compras existentes. Recompra, painel de vendas e correção da retirada não exigem as novas tabelas.

## Política de fidelidade

- A primeira configuração define o início do acúmulo. A taxa em centavos por ponto fica fixa depois de salva, evitando reavaliar retroativamente os pontos.
- A loja pode ajustar os pontos exigidos e o desconto dos **próximos** resgates. Cupons já emitidos preservam o valor.
- Pausar impede resgates; compras continuam acumulando e cupons existentes permanecem válidos.
- Cada venda concluída gera `floor((total − frete) / valorPorPonto)`. Descontos já estão descontados do total. Serviços só contam se lançados em venda concluída do Hub; um atendimento finalizado sozinho não comprova pagamento.
- Vendas com Mercado Pago exigem status `approved`; vendas de balcão sem ID/status MP podem contar quando concluídas. Pendentes, canceladas e estornadas não contam.
- O saldo é recalculado das vendas elegíveis menos resgates. Pode ficar negativo após estorno de compra cujos pontos já foram resgatados; novos resgates ficam bloqueados até recuperar o saldo.
- Resgate transacional serializável + bloqueio por cliente evita gasto simultâneo dos mesmos pontos. O cupom só pode ser usado pelo titular e não pode ser reservado em dois pedidos simultâneos.
- Cupom válido por 90 dias, mínimo de compra igual ao desconto + R$1, aplicado apenas a produtos. Não acumula com outro cupom. Cancelar um pedido libera o cupom dentro da validade; não devolve pontos já trocados pelo cupom.
- Nenhuma regra comercial foi ativada automaticamente na produção.

## Limites e operação

- Até 200 produtos salvos e 20 avisos de estoque ativos por cliente. Até cinco solicitações de agenda pendentes.
- Polling de preferências/solicitações a cada 60 segundos apenas com a página visível. Não há job em background nem promessa de aviso com o site fechado; o calendário é uma alternativa opcional do cliente.
- Uma avaliação por cliente/produto, editável. Avaliações ocultadas não são republicadas só porque o cliente edita. Compras posteriormente estornadas deixam de qualificar a exibição pública.
- Pedidos de agendamento confirmados exigem contato com a loja para alteração/cancelamento; cancelar a solicitação pendente pelo portal não cancela nada no ERP.
- A integração direta com `/api/petshop-agendamentos/agendar?expediente={id}` já está implementada. Em produção, ela exige `SIGGMA_AGENDAMENTO_EXPEDIENTE_ID` e `SIGGMA_AGENDAMENTO_SERVICOS_JSON`; sem esses valores, o portal usa a solicitação à equipe como fallback. O endpoint oficial valida o horário solicitado e uma rejeição não cria reserva local falsa.

## Verificação

`node --test tests/customer-experience.test.cjs` executa testes de autorização, CSRF, validação, propriedade de pet, recompra, avaliação e pontos/cupons. Esses testes usam dublês para os serviços externos.

Opcional: defina `PGLITE_PATH` para uma instalação de `@electric-sql/pglite` para executar também a migração real em um PostgreSQL WASM isolado, verificando referências e unicidade. Não substitui o ensaio na branch de produção.

Testes de navegador usam dados fictícios e interceptam chamadas de API. Não são evidência de migração ou integração ERP/pagamento ativa em produção.
