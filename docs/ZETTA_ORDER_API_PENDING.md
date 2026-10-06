# Contrato confirmado — pedidos e estoque Zetta

Em 06/10/2026 a Zettabrasil confirmou o contrato usado pelo Hub da Matilha Prado.

## Pedidos de e-commerce

- Escrita: `POST /api/pedidos-integracao/importar`.
- A reserva de estoque acontece na importação; a baixa física acontece no faturamento.
- Se o pedido for cancelado no Zetta antes do faturamento, a reserva é desfeita.
- O Zetta não bloqueia reenvio do mesmo ID externo. A idempotência precisa ser garantida pelo Hub.
- A resposta informa sucesso/erro e não devolve o ID interno criado.
- O lote é atômico: se um pedido tiver erro, nenhum pedido do lote é gravado.
- Cada canal deve informar seu `ecommerceId`.
- Mercado Livre pode ser importado sem CPF/CNPJ.
- Amazon e demais canais exigem CPF/CNPJ válido.

## Vínculo dos itens

O Zetta não possui um campo SKU separado para essa integração. O SKU enviado pelo
marketplace deve ser exatamente o valor do campo `codigo` retornado por
`GET /api/itens-integracao`.

Se esse código não for encontrado, o Zetta pode gravar o item sem reservar estoque e
sem retornar erro. Por isso o Hub valida a igualdade do SKU antes de enviar o pedido.

## Idempotência aplicada no Hub

O Hub protege a integração em duas camadas:

1. `Venda.marketplaceOrderId` é único por `canal:id-do-marketplace`;
2. `Venda.siggmaGuid` também é único e a importação usa um claim de processamento antes do POST.

Assim, uma repetição do webhook/polling do marketplace não pode criar uma nova venda no
Hub nem deve reservar estoque novamente no Zetta.

## Estoque

O saldo autoritativo é `GET /api/itens-integracao`. Como o Zetta confirmou que a
reserva atualiza o saldo imediatamente, depois de importar vendas o Hub relê o Zetta e
propaga esse saldo para Mercado Livre e Amazon. Nunca somamos os saldos dos marketplaces.

## Notas e faturamento

- `GET /api/notas-saidas/notas-simplificado` e `GET /api/notas-saidas`: notas faturadas, paginadas, com `since`.
- `GET /api/notas-saidas/get-faturamento`: faturamento diário ou mensal.
- `POST /api/notas-saidas/status-notas`: consulta pelo GUID.
- Antes de existir nota, o GUID pode retornar `EXCLUIDO`; isso não significa que a importação do pedido falhou.
- Cancelar, devolver ou reembolsar não é suportado pela API e deve ser feito no Zetta.

## Configuração pendente por ambiente

Preencher na Vercel os IDs reais cadastrados no Zetta:

```env
SIGGMA_ECOMMERCE_ID_SITE=
SIGGMA_ECOMMERCE_ID_MERCADO_LIVRE=
SIGGMA_ECOMMERCE_ID_AMAZON=
```

Não inventar esses IDs. Eles precisam vir do cadastro de e-commerce do Zetta.
