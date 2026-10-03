# Integração de pedidos Siggma/Zetta — implementada

A documentação OpenAPI oficial recebida da Zettabrasil confirma o endpoint:

`POST /api/pedidos-integracao/importar`

Ele importa pedidos de e-commerce para `ecommerce_vendas`. O banco PostgreSQL
fornecido pela Zetta continua sendo somente leitura; nenhuma venda do Hub é
gravada diretamente em tabelas do ERP.

## Fluxo aplicado no Hub

1. O catálogo usa preço e estoque oficiais do Zetta.
2. No checkout, produtos vinculados ao Zetta são revalidados ao vivo por
   `GET /api/itens-integracao/{id}`.
3. O Hub cria a venda local como `pendente`, sem diminuir artificialmente o
   saldo oficial do Zetta.
4. Quando o pagamento real é aprovado, o Hub chama
   `importarVendaNoSiggma(vendaId)`.
5. A importação usa `POST /api/pedidos-integracao/importar`.
6. Após sucesso, o Hub executa nova sincronização de produtos para refletir o
   saldo retornado pelo ERP.

## Idempotência

A rota oficial **só cria pedidos**. Reenviar o mesmo pedido duplicaria
`ecommerce_vendas`.

Por isso o Hub:

- gera um GUID determinístico a partir do ID da `Venda`;
- marca a importação local como `processing` antes de enviar;
- persiste `siggmaImportedAt` após sucesso;
- não envia novamente uma venda já importada;
- marca falhas conhecidas como `rejected` e falhas incertas como `review`.

## Cancelamento

A documentação oficial informa que `/api/pedidos-integracao/importar` não
cancela nem atualiza pedidos. Cancelamentos após a importação ficam marcados
como `cancelamento-revisao` no Hub e precisam seguir o fluxo operacional do
Siggma até que a Zetta forneça uma API oficial de cancelamento.

## Teste de produção

O teste completo deve validar, nesta ordem:

- preço e estoque antes do checkout;
- criação da `Venda` local;
- aprovação do pagamento;
- `siggmaImportStatus=imported`;
- existência do pedido em `ecommerce_vendas` no Siggma;
- nova leitura de estoque no Zetta.

Não usar gravação SQL direta no PostgreSQL do ERP.
