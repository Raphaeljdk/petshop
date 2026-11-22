# Contenção de estoque — Matilha Prado / 21-11-2026

## Sintomas reportados
- Produtos descontinuados voltam a ser anunciados, inclusive Adoleta e Damascoto.
- Quantidades do Mercado Livre e da Amazon divergem do estoque físico, para mais e para menos.
- Ajustes manuais parecem ser desfeitos após atualizar uma página.
- Existe um cron de marketplace a cada 30 minutos no Vercel.

## Raízes identificadas
1. As APIs `GET /api/cliente/produtos` e `GET /api/public/produtos` chamavam `syncZettaProductsToLocal()`, que grava `Produto.estoque` com valores da API do Zetta/Siggma. **Leituras não podem escrever estoque.**
2. O cron `/api/cron/marketplaces` executava importação de pedidos e depois atualizações automáticas de quantidade/reativação, com base em `Produto.estoque` potencialmente divergente.
3. `syncLocalStockToMarketplaces()` tratava todo produto oculto com estoque positivo como candidato a republicação, sem status "descontinuado".
4. Anúncio Mercado Livre pausado com quantidade positiva era reativado automaticamente.
5. Produtos novos importados do ML ou Amazon podiam inicializar `Produto.estoque` com a quantidade anunciada, sem contagem física.
6. Há SKUs compartilhados por cadastros espelhados; vendas desses itens ficam pendentes da associação única, sem baixa automática segura.

## Contenção implementada
- Leituras da loja usam somente o banco local; nenhuma chamada Zetta/Siggma ou escrita de estoque e sem cache público de quantidade.
- Cron de 30 minutos **continua importando vendas**; **não escreve automaticamente estoques**, não reativa anúncios nem publica produtos. Gate `MARKETPLACE_STOCK_WRITES_ENABLED` (somente valor literal `true` permite escritas). Deixar **ausente/desativado** após publicação.
- O botão de sincronização manual de vendas usa a mesma trava; `force` não desativa a proteção.
- Uma reativação automática de produto oculto ou de anúncio pausado deixou de ser permitida também se as escritas forem reabilitadas no futuro.
- Catálogos ML/Amazon importados continuam registrando quantidades anunciadas como referência, mas novos produtos entram com estoque físico 0 e ocultos até conferência.
- Conferência física não reativa automaticamente produtos anteriormente ocultos. O administrador deverá publicar expressamente.

## Regra final — Hub é o estoque principal

- **Hub → ML/Amazon**: ao alterar a quantidade no cadastro do Hub, o `PUT /api/produtos/[id]` salva o estoque físico e tenta enviar a quantidade aos anúncios vinculados, quando as escritas estiverem liberadas. O retorno diferencia saldo salvo, envio submetido e pendências por canal.
- Cada solicitação tenta sincronizar **somente o produto alterado**. A verificação periódica de 30 minutos continua como reconciliação e importação de pedidos; não lê estoque remoto como fonte de saldo físico.
- Ao desativar um produto no Hub, a quantidade publicada passa a **zero**. Quando for reativado explicitamente, o sistema pode solicitar a ativação do anúncio pausado do Mercado Livre (sem contornar moderação, estado encerrado ou inconsistências de SKU).
- Produtos ocultos **não são reativados só porque o estoque aumentou**. Adicionar estoque em um item descontinuado não o publica.
- Produto **ativo** que fica sem estoque permanece ativo no cadastro, mas indisponível para vendas com saldo zero; ao receber novas unidades no Hub, volta a enviar a quantidade. No Mercado Livre, a reativação automática só é permitida quando o anúncio estava pausado **exclusivamente por falta de estoque**; pausa feita pelo vendedor continua exigindo comando explícito.
- A consulta à página do catálogo não altera estoques. Os registros de estoque usados na loja refletem o Hub, não somas de ML/Amazon.
- SKUs presentes em múltiplos cadastros são bloqueados para envio automático até conciliação das identidades e da quantidade física única. A mesma regra vale para edições manuais e o cron.
- A Amazon confirma inicialmente apenas o recebimento da solicitação de atualização, não a publicação definitiva. A equipe deve conferir retorno assíncrono e saldo efetivamente anunciado.
- A chave `MARKETPLACE_STOCK_WRITES_ENABLED=true` libera o envio automático **somente depois da homologação dos vínculos e estoques**. Enquanto ausente, o Hub salva os valores, mas responde `suspended`; não apresentar como sincronizado.
- A interface do Hub apresenta o status do envio (submetido, suspenso ou com divergência), sem tratar o sucesso do banco local como prova de atualização nos marketplaces.

## Auditoria de sinal de movimentação (+/-) e compra pelo site

- **Saída confirmada: -Q**. As vendas locais, importadas de marketplaces e as compras do portal usam a mesma operação `debitForSale(Q)`, que aplica `estoque: {decrement:Q}` atomicamente, com checagem de saldo onde a reserva pode ser recusada.
- **Reserva pendente cancelada: +Q**. A liberação ocorre uma única vez, com `creditReleasedReservation(Q)`. Serviços com `estoqueIlimitado` não recebem incrementos indevidos.
- **Venda concluída cancelada: zero automático**. A mercadoria já pode ter saído fisicamente. O operador confere a devolução e faz entrada no Hub (sem inventar estoque no cancelamento).
- **Venda cancelada reaberta:** exige conciliação e nova venda; não recobrar o mesmo estoque arbitrariamente.
- **Pedido importado de marketplace:** não pode ser excluído, pois a remoção da chave `marketplaceOrderId` permitiria ao cron importar o pedido outra vez e debitar novamente.
- **Sincronização pós-movimentação:** mudanças confirmadas no Hub tentam atualizar os marketplaces vinculados imediatamente quando a proteção de escrita estiver liberada; o cron permanece como conciliação eventual.
- **Checkout e recompra do portal:** nem mesmo itens com `zettaProCod` consultam Zetta/Siggma. Consulta de preços e disponibilidade usa exclusivamente `Produto.estoque` e a baixa do checkout é atômica, com atualização de `estoqueHub`.
- **Regressões:** `tests/sale-stock-policy.test.ts` verifica débito -1, liberação +1 e prevenção de cancelamentos sem devolução; `tests/customer-experience.test.cjs` verifica checkout legado com -1 e recompra sem estoque externo.

## Ações operacionais urgentes após publicar a contenção
1. Exportar os atuais SKUs, estoque físico conferido, quantidades e status de anúncios de ambos os marketplaces. **Não somar os estoques de cada canal.**
2. Revisar anúncios com saldo físico zero e quantidade anunciada positiva: pausar/zerar MANUALMENTE no Mercado Livre e na Amazon. A trava evita novas escritas, mas não corrige anúncios já ativos.
3. Conferir os SKUs espelhados e variações, vinculando IDs ML/ASIN aos produtos corretos. Não fundir ou excluir registros sem validação das vendas e histórico.
4. Conferir pedidos pendentes que não deram baixa, evitar devolução ou reativação incorreta, e reconciliar saldos com a equipe.
5. Antes de liberar escritas futuras, homologar numa base isolada o fluxo **ERP físico confirmado → quantidade por SKU/variante nos marketplaces**, com livro de movimentações, bloqueio definitivo de produtos descontinuados, auditoria por fonte, read-back da API e tratamento de erros/concorrência.

## Verificações
- Teste de política `bun test tests/marketplace-publish-policy.test.ts`.
- Confirmar que `GET` da loja não chama `syncZettaProductsToLocal` e não altera `Produto.updatedAt`.
- CI build/typecheck; testes de autenticação e fluxo de compras.
- Verificar status no painel de Integrações: **escritas de estoque suspensas**.
- Não executar API de reativação de anúncios durante homologação sem autorização do responsável e sem saldos físicos reais.

> **Aviso:** alteração de código ainda não é mitigação em produção. Precisa de release validado na Vercel. Até lá a rotina antiga continua executando.
