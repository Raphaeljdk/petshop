# Emissor Mercado Pago na Matilha Prado — fluxo sem provedor adicional

## Fatos confirmados em outubro de 2026
- O Sistema de Gestão Mercado Pago possui emissão de NF-e/NFC-e pelo próprio portal, após configurar dados fiscais e certificado A1.
- O Access Token da API de **pagamentos** não é uma API fiscal de transmissão. Nenhum endpoint público do Mercado Pago para o ERP comandar a emissão externa foi comprovado neste projeto.
- Mercado Livre Faturador: emissão por API apenas de pedidos do próprio Mercado Livre. Não aceitar IDs de pedidos externos Amazon/site nessa API.
- Amazon SP-API: a função Tax Invoicing permite recuperar determinados documentos FBA se o vendedor tiver autorização, mas não habilita emissão universal das vendas Amazon.
- Sobre custos: o Mercado Pago divulga emissão ilimitada sem custo por nota, porém existe comunicação de valor mensal do Sistema de Gestão após o período de testes; verificar a situação comercial concreta com a conta empresarial.

## Ações novas na aba Fiscal e Notas
- **Abrir Mercado Pago**: abre o painel oficial, sem inserir token ou certificado no ERP.
- **Copiar dados**: prepara resumo de pedido com produtos, quantidades, cliente, NCM, valores/frete e campos ainda pendentes. O resumo é para revisão fiscal, não nota válida e não cria segunda cobrança.
- **Registrar NF-e emitida**: após emitir no Mercado Pago, salvar chave de 44 dígitos no pedido. Validação do dígito verificador, CNPJ do emitente, modelo, série/número e não duplicação. Resultado é *informada_pendente_verificacao*, nunca “autorizada” sem conferência fiscal.
- **Consultar NF-e** Mercado Livre e XML/DANFE ficam com integração existente.
- Não fazer cobranças adicionais para emitir nota já paga; consultar o suporte Mercado Pago para como registrar pagamento externo na frente de caixa.
- XML/DANFE oficiais continuam baixados diretamente do emissor Mercado Pago.

## O que falta para emissão por um clique no ERP
- Documentação oficial e permissão explícita de API fiscal externa Mercado Pago, caso exista, ou construir a integração direta SEFAZ por conta própria (infra/segurança/homologação/MOC/fiscal).
- Uma chave de acesso com DV correto NÃO confirma que a SEFAZ autorizou a NF-e.
- Para serviços, NFS-e deve ser tratada separadamente.

### Como testar sem emitir
1. ADMIN → Fiscal e Notas → Pedidos e notas.
2. Escolha uma venda concluída e clique **Copiar dados** (dados sensíveis permanecem no clipboard local do administrador).
3. Clique **Abrir Mercado Pago**; não crie uma segunda cobrança para testar.
4. Teste chave inválida, CNPJ distinto ou 44 dígitos com DV errado: o registro deve falhar.
5. Só use **Registrar NF-e emitida** em uma venda que já tenha documento verdadeiro, conferido no emissor.
6. A nota registrada continua como **pendente de verificação**, mesmo que o operador confirme o XML no Mercado Pago. Nenhum endpoint transmite NF-e nessa operação.
