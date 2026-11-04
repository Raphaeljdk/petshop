# Freitas Corp — preparação de split Mercado Pago de R$ 2 por venda

**Estado: planejamento técnico, sem comissão ativa e sem alteração no checkout em produção.**

## Auditoria realizada em 04/11/2026

- `src/app/api/pagamento/criar/route.ts` chama `criarOrderMercadoPago`.
- `src/lib/mercado-pago-orders.ts` executa `POST /v1/orders` (Orders API), com token da Matilha Prado (`MERCADO_PAGO_ACCESS_TOKEN` ou configuração atual).
- `src/app/api/pagamento/status/route.ts` e `src/app/api/pagamento/webhook/route.ts` reconciliam `/v1/orders/{id}`.
- `.env.example` declara a integração como Checkout Transparente (Orders API).
- Não modificar o token existente, public key, webhook Order, cobranças abertas, estados, estoque, NF-e ou vendas anteriores.

## Restrição do provedor

A documentação oficial informa que a Orders API **não tem campo explícito equivalente a `application_fee`** para Split 1:1. A implementação documentada para marketplace usa:

- `POST /v1/payments` + `application_fee: 2.00` (Checkout Transparente/Payments API), com **OAuth do vendedor**;
- ou `POST /checkout/preferences` + `marketplace_fee: 2.00` (Checkout Pro), com OAuth do vendedor.

Nunca acrescentar `application_fee` em `/v1/orders` esperando repasse. Nunca cobrar duas vezes nem fazer transferência presumida. O split é do valor da venda, não R$ 2 adicionais ao comprador. As taxas do Mercado Pago são descontadas do vendedor conforme documentação.

Documentação oficial:
- https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/create-configuration
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders

## Implementação necessária antes de ativação

1. Formalizar o consentimento do proprietário por escrito: comissão R$ 2 por transação online aprovada, incidência, reembolsos, vendas de baixo valor, rescisão, relatórios e titularidade.
2. Criar/validar aplicação Mercado Pago da Freitas Corp no modelo Marketplace, KYC e acesso adequado; pedir autorização OAuth explícita à conta Matilha Prado. Nunca pedir senha/token do cliente por mensagem.
3. Implementar callback OAuth com `state` aleatório, anti-CSRF, HTTPS, criptografia de tokens em repouso, controle de expiração/refresh e isolamento por vendedor; validar identidade `user_id` da conta autorizada.
4. Criar uma **nova** rota de checkout compatível por trás de flag **desligada por padrão**. Preservar Orders API para pedidos antigos; registrar `paymentProvider`, `gatewayVersion`, `paymentId`, `sellerAccountId` e ids de idempotência antes de migrar.
5. Nunca mudar o processador de uma venda com cobrança pendente. Garantir idempotência e exclusividade de cobranças por venda mesmo com tentativas/retries.
6. Implementar webhook do Payments API separado, validar assinatura e consultar pagamento no Mercado Pago com token OAuth do vendedor antes de conciliar. Não aplicar status Order em payload Payment. Preservar importação Siggma, estoque, emissão fiscal e regras existentes.
7. Ledger financeiro separado e imutável para comissão estimada, confirmada, devolvida e líquido conciliado. Unicidade por provider + paymentId + tipo de lançamento; receber estorno/chargeback apenas uma vez. Não registrar a comissão na venda local como se fosse prova de repasse.
8. Testar sandbox Pix/cartão e modalidades suportadas, pagamento aprovado/pendente/recusado, 3DS, estorno total/parcial, webhook duplicado, indisponibilidade OAuth, valores mínimos e pedido abandonado. Não migrar boleto sem homologação de suporte no novo fluxo.
9. Comparar recebimentos reais de ambas as contas contra extratos, incluindo taxas. Liberar canário em produção apenas após aprovação comercial e técnica, com rollback para Orders API antes de novas cobranças. Manter reconciliação de cobranças antigas.
10. Restringir painel Freitas Corp com autenticação independente; não incluir controles financeiros da Freitas no painel do estabelecimento salvo informação contratualmente acordada.

## Regra proposta (ainda não aplicada)

- Comissão fixa **200 centavos**, por venda online elegível com pagamento aprovado na integração de marketplace.
- Não cobrar em dinheiro, Pix externo, PDV, marketplace Mercado Livre/Amazon ou vendas simuladas.
- Valor total precisa ser maior que R$ 2; valores menores exigem regra contratual, sem rateio automático aqui.
- Apenas um repasse por transação elegível; reembolsos devem ser refletidos no ledger.
- A flag deve depender de consentimento + OAuth válido + integração homologada + habilitação operacional. A função `evaluateFreitasCorpSplit` é só preparação sem efeitos colaterais.

## Checklist de go-live

- [ ] Acordo com estabelecimento assinado.
- [ ] Conta da Freitas Corp e aplicação Marketplace aprovadas.
- [ ] OAuth do proprietário autorizado e testado.
- [ ] Novo checkout Payments API implementado, com UI Pix/cartão compatível.
- [ ] Webhook Payments isolado e reconciliação financeira testados.
- [ ] Migrations revisadas com backup, testes/build e ambiente de preview aprovados.
- [ ] Validação real de repasse, estorno e extratos de ambas as contas.
- [ ] Autorização explícita de ativação em produção.

**Não substituir variáveis MERCADO_PAGO_ACCESS_TOKEN ou NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY existentes agora.**
