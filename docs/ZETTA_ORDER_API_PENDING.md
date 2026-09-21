# Pendência externa — gravação de pedidos Siggma/Zetta

A leitura do ERP está concluída pela bridge Oracle e o Hub já conhece clientes, pets,
históricos, produtos, preços e estoque. O banco PostgreSQL fornecido pela Zetta é somente
leitura; portanto nenhuma venda do site deve ser gravada diretamente nas tabelas do ERP.

## Informação necessária da ZettaBrasil

Confirmar o endpoint oficial de escrita para registrar uma venda/pedido originado no
e-commerce. Precisamos do contrato de uma operação equivalente a:

- criar pedido de saída / venda de e-commerce;
- identificar o cliente pelo `CLIENTES.cli_cod`;
- identificar cada item por `PRODUTOS.pro_cod`;
- informar quantidade, preço, desconto, frete e total;
- informar filial/estoque quando obrigatório;
- enviar uma referência externa idempotente (ID da `Venda` do Hub);
- receber o identificador do pedido criado no Siggma;
- consultar o pedido depois pela referência/ID;
- confirmar em qual etapa o estoque é movimentado (criação, faturamento ou finalização);
- confirmar como cancelamento/estorno deve ser enviado.

Também precisamos saber se a operação usa `PEDIDO_SAIDAS`, `ecommerce_vendas` ou outro
recurso da API e quais status devem ser usados para pedido pago pelo Mercado Pago.

## Segurança aplicada no Hub

Enquanto `SIGGMA_ORDER_CREATE_PATH` não estiver configurado, o Hub:

1. exibe catálogo, preço e estoque reais do Zetta;
2. revalida preço e estoque no ERP no checkout;
3. **não cria a venda/cobrança de itens Zetta**;
4. informa ao usuário que a integração de pedidos ainda aguarda a API de escrita.

Isso evita pagamento sem baixa/registro no ERP e evita divergência de estoque.
