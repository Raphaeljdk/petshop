# Conciliação de SKUs e validação de APIs — Matilha Prado

## Estratégia de segurança

**Estoque físico do Hub é a única autoridade.** Saldos de Mercado Livre, Amazon ou Zetta/Siggma são referências externas, não reposições automáticas. A auditoria abaixo é somente leitura; não altera registros, pedidos, anúncios ou quantidades.

O painel **Integrações → Auditoria de estoque e conexões ML/Amazon** oferece:

- **Conferir SKUs do Hub**: agrupa todos os produtos com mesmo SKU, marca divergências de saldos, nomes, publicação, saldo operacional versus Hub e ASINs reutilizados
- **Exportar pendências (CSV)**: um registro por produto espelhado, com IDs de cadastro e canais, para identificar a linha física correta. Ao abrir no Excel, **importe SKU como texto** para preservar zeros à esquerda
- **Testar APIs em modo leitura**: consulta autenticada de listagens ML e Amazon via os endpoints de status existentes, sob login ADMIN, sem operações de publicação ou estoque
- Mostra quantidade de vendas de marketplaces com baixa ainda não confirmada

### Interpretação dos grupos

- `physical_count`: estoques diferentes, saldos Hub divergentes ou estado de publicação inconsistente. **Contagem física e validação da equipe obrigatórias**.
- `identity_review`: variações ou nomes diferentes com mesmo SKU. Confirmar se é mesmo produto, tamanho, cor, kit ou anúncio. Não somar nem escolher o maior estoque.
- `identical_mirrors`: cadastros aparentemente iguais, mas ainda requer confirmação de qual ID receberá o vínculo e ficará como produto principal.
- ASIN duplicado com SKUs diferentes **não é prova** de mesmo item. Amazon pode usar o mesmo ASIN para ofertas/vínculos distintos; conferir variações e Seller SKU.

### Ordem de homologação das duas APIs

1. Verificar o acesso de **leitura autenticada** nas duas plataformas no painel administrativo e guardar a resposta (sucesso, não autorizado, limites, configuração).
2. Conferir qual SKU/Seller SKU está associado a cada anúncio, incluindo `variation_id` no Mercado Livre quando houver variações; preservar IDs de vendas.
3. Conferir fisicamente os SKUs duplicados e corrigir os vínculos com aprovação do responsável. **Não alterar estoque físico com base nas quantidades remotas**.
4. Conferir os pedidos sem `marketplaceStockAppliedAt`, comparando com a movimentação física e notas, para que a baixa seja aplicada **uma única vez**. Não reprocessar automaticamente os 14 pedidos pendentes sem isso.
5. Com o canal e o produto de teste escolhidos, testar primeiro uma atualização **em ambiente de homologação/sandbox**, quando disponível; alternativamente usar um único SKU conferido com autorização da equipe, não um SKU com múltiplos cadastros.
6. Comparar o saldo esperado do Hub, a resposta à escrita e uma segunda leitura do anúncio após o processamento (a Amazon pode aceitar a solicitação antes da confirmação final).
7. Só após resultados consistentes, configurar `MARKETPLACE_STOCK_WRITES_ENABLED=true` na produção e validar outro ciclo do cron de 30 minutos.
8. Ao testar uma venda real, usar um pedido já realizado/legítimo, não comprar ou criar pedidos artificiais no canal; confirmar que o estoque físico diminuiu exatamente `-Q` uma vez.

### Limites

- Um banco com SKUs espelhados não oferece evidência suficiente para fusão automática segura; a equipe precisa validar fisicamente e selecionar o cadastro principal antes de qualquer reatribuição.
- Os testes de CI simulam regras de negócio, **não** validam credenciais dos vendedores. O botão **Testar APIs em modo leitura** fará consultas reais com as credenciais do projeto somente após publicação; sem sessão ADMIN não é possível executá-las de fora do Hub.
- Em situação de risco, manter as escritas automáticas suspensas e controlar/pausar os anúncios incorretos diretamente nos canais enquanto a equipe confere o estoque.
- Não publicar a PR como correção concluída antes de verificar a tela de auditoria, dados de produção e testes com saldos físicos conferidos.

## Verificação automatizada

`bun test tests/sku-reconciliation-audit.test.ts tests/marketplace-publish-policy.test.ts tests/sale-stock-policy.test.ts`

Também executar CI do release e testes de autenticação. Dados reais não são gravados no repositório: o relatório é gerado sob demanda no painel autenticado.
