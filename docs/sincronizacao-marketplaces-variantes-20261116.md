# Matilha Prado — estoque multicanal e variantes

## Automação
- Cron de Vercel a cada 30 minutos, autenticado por CRON_SECRET, usando a rota /api/cron/marketplaces.
- Primeiro importa pedidos pagos por ID único de marketplace; depois reduz o estoque operacional único e distribui o saldo final aos canais vinculados.
- O botão Sincronizar agora usa a mesma rotina. O cron de cancelamentos continua diário e não duplica o trabalho.
- MarketplaceSyncRun mantém uma trava temporária (sete minutos), início/fim, atualização de estoque e erros para a área Integrações.
- Na primeira execução sem histórico, lê pedidos das últimas 24 horas; com checkpoint existente recupera até sete dias.
- Falhas de permissão como UNAUTHORIZED e HTTP 401/403 entram em MarketplaceStockIssue e têm recuo de seis horas; demais falhas recuam por 30 minutos. O botão manual pode revalidar.
- Nunca somar saldos de outros marketplaces ao estoque físico do ERP ou dar baixa duas vezes no mesmo pedido.

## Segurança e variações
- Cada venda com SKU específico baixa a variante correta; anúncios com ID compartilhado e SKU não resolvido não devem causar baixa no produto errado.
- Um anúncio ML ligado a múltiplos produtos físicos não recebe PUT de quantidade total. Precisa identificar variation_id e tratar o estoque por variante na API específica.
- A Amazon pode aceitar uma submissão PATCH sem ainda refletir a alteração. Confirmar saldo real no marketplace.
- A vitrine agrupa cores e tamanhos reconhecidos, conservando cada SKU e estoque da variante.
- A aba Integrações mostra blocos de família para os anúncios visíveis em cada página e mantém ações individuais.
- Não cria nem funde anúncios reais dentro do Mercado Livre ou Amazon; isso exige compatibilidade de catálogo, permissões e testes por canal.

## Conferências antes da produção
1. Migrations criadas para as tabelas de controle e pendências; aplicadas em banco Neon isolado de homologação.
2. CI: release build, testes de catálogo/variantes e autenticação com navegador.
3. Cron sem o segredo deve devolver 401.
4. Testar pedidos pagos, confirmação idempotente e saldo único; conferir SKU específico.
5. Revalidar manualmente anúncio com bloqueio de política e anúncios com várias variações.
6. Confirmar se a Amazon refletiu o saldo após receber PATCH.
7. Só publicar depois de revisar os resultados e credenciais reais.

Observação: integração conectada não significa autorização para alterar todos os anúncios; os erros permanecem visíveis no painel.
