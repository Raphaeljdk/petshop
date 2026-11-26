# Emissão própria da Matilha Prado

Na área Fiscal, filtre as vendas por dia, semana ou mês e abra **NF-e própria · série 2** na venda concluída. Confira o comprador, endereço, pagamento, frete e eventual emissão anterior. Ao preparar, o ERP reserva o número e grava o XML assinado na mesma transação. A transmissão à SEFAZ-SP é uma ação posterior e explícita.

O emissor usa NF-e 55, série 2, ambiente 1, CRT 1 e apuração pelo PGDAS-D. A segunda faixa não gera rateio do DAS no XML. O cenário implementado é a venda interna em SP a consumidor final não contribuinte, com CSOSN 102. O CST 49 exige aprovação expressa da base, alíquota e valor zero. Cada SKU requer aprovação específica da revisão vigente da regra. Uma venda com ST, IPI, IBS/CBS ou outra classificação ainda sem tratamento é bloqueada antes da reserva. O produto usado em homologação não recebe aprovação de produção automaticamente.

O site usa o comprador vinculado à venda. Na Amazon, o ERP consulta o pedido pela SP-API, confere o total em BRL, o envio pelo vendedor, o estado anterior à expedição e o status fiscal NOT_FOUND. Exige o CNPJ cadastrado do intermediador e o Seller ID, além da conferência do operador sobre documentos externos. Pedidos FBA, Invoice by Amazon, vendas importadas com faturamento externo e Mercado Livre permanecem em seus fluxos próprios.

## Publicação e liberação

1. Na PR, valide as regressões fiscais com PostgreSQL isolado, o build e a prévia. A prévia não transmite à SEFAZ de produção.
2. Aplique as migrations fiscais via Prisma e confira o histórico de migrations. A criação das tabelas não ativa o emissor. A numeração da homologação não participa do cálculo.
3. Confira XMLs de saída, cancelamentos, denegações, inutilizações e números pendentes em todos os emissores. A série 2 começa em 1 quando os históricos interno e externo estão vazios. A configuração considera o maior número de ambos e preserva o avanço do contador.
4. Registre a aprovação de cada SKU e a conciliação em uma sessão administrativa com acesso ao banco. Execute `bun scripts/nfe-real-configurar.ts /caminho/evidencia.json`. A operação `aprovar-sku` recebe `regraId`, `sku`, `referenciaContabil`, `aprovadoParaProducao` e `baseZeroCst49`. A operação `conciliar-serie` recebe `maiorNumeroExterno`, `referenciaNumeracao`, `referenciaContabil` e `confirmadaExclusividade`. Os campos de referência identificam a manifestação real da contabilidade e a conferência do histórico. Guarde as evidências com acesso restrito.
5. Confira em Production as configurações protegidas do A1, Resend, remetente em `RESEND_FROM_EMAIL` (com suporte ao remetente de convites existente) e autenticação do cron. Para Amazon, configure também `NFE_AMAZON_CNPJ_INTERMEDIADOR` com o dado aprovado e use a conta de vendedor já vinculada. Depois da validação e das aprovações, habilite `NFE_EMAIL_AUTOMATICO_ENABLED` e `NFE_REAL_HABILITADA` e publique a configuração. A validação final dos dados comerciais e da assinatura ocorre por venda.

## Retornos e documentos

- Em timeout, mantenha a mesma chave. Consulte o recibo quando houver. Sem recibo ou protocolo, uma consulta que devolva 217 pelo menos três minutos após a última tentativa permite retransmitir os mesmos bytes. As solicitações concorrentes são serializadas no PostgreSQL.
- Uma rejeição definitiva permite corrigir a nota com a mesma numeração. Respostas de duplicidade ou de conteúdo incompatível entram em conciliação. Os pedidos e os retornos ficam no histórico fiscal.
- A autorização exige ambiente, chave, digest do XML e protocolo correspondentes. Na mesma transação, o ERP grava o XML processado e enfileira o e-mail. O cron entrega XML e DANFE PDF pelo Resend. O identificador de idempotência é constante por nota. Entregas incertas fora da janela de reenvio exigem conferência no provedor.
- O cancelamento registra o evento 110111, a justificativa e o protocolo da SEFAZ. A ação exige confirmação de que não houve circulação. Em resposta incerta, consulte a chave antes de reenviar o mesmo evento. O XML original da NF-e é preservado.
- Em SP, desde 1º/11/2026, o operador pode registrar a quebra e prosseguir com a sequência. Na transição até março de 2027, a opção de inutilização transmite somente o número da reserva encerrada. Uma aceitação exige cStat 102, protocolo e correspondência da faixa, ano, emitente, série e ambiente. O número nunca volta à sequência.

## Referências

O XML da NF-e usa o PL 010h v1.03, publicado em 13/11/2026. O evento de cancelamento usa Evento_Canc_PL_v1.01. Os pontos de entrada de lote e processamento vêm do PL 009p, e a inutilização combina os pontos de entrada oficiais com o leiaute atualizado do PL 010d v1.03. Os pacotes e seus hashes são versionados para validação local.

[Esquemas oficiais do Portal Nacional](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D) · [Web services de SP](https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx) · [Comunicado paulista sobre inutilização](https://portal.fazenda.sp.gov.br/servicos/nfe/)
