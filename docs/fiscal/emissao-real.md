# Emissão própria da Matilha Prado

Na área Fiscal, filtre as vendas por dia, semana ou mês e abra **NF-e própria · série 2** na venda concluída. Confira o comprador, endereço, pagamento, frete e eventual emissão anterior. Ao preparar, o ERP reserva o número e grava o XML assinado na mesma transação. A transmissão à SEFAZ-SP é uma ação posterior e explícita.

O emissor usa NF-e 55, série 2, ambiente 1, CRT 1 e apuração pelo PGDAS-D. A segunda faixa não gera rateio do DAS no XML. O cenário implementado é a venda a consumidor final não contribuinte, com CSOSN 102, em SP ou em outra UF somente quando houver regra específica aprovada para a operação e o SKU. A seleção de CFOP 5102/6108 para não contribuintes aplica-se à revenda parametrizada; não substitui a avaliação fiscal. O CST 49 exige aprovação expressa da base, alíquota e valor zero. Cada SKU requer aprovação específica da revisão vigente da regra. Uma venda com ST, IPI, IBS/CBS ou outra classificação ainda sem tratamento é bloqueada antes da reserva. O produto usado em homologação não recebe aprovação de produção automaticamente.

O site usa o comprador vinculado à venda. Em uma venda Amazon, **Conferir pedido na Amazon** consulta o pedido selecionado antes de reservar qualquer número. O ERP verifica o marketplace brasileiro, o valor em BRL, o envio pelo vendedor, a situação anterior à expedição e o status fiscal NOT_FOUND. Para pedidos importados sem contato fiscal local completo, a SP-API deve fornecer nome, CPF ou CNPJ do comprador e e-mail do pedido. O ERP utiliza os dados na nota e no envio dos anexos sem criar conta no portal. Pedidos duplicados, compradores divergentes, FBA e Invoice by Amazon bloqueiam o preparo. A confirmação do operador continua necessária para documentos externos ao marketplace.

O intermediador da Amazon Brasil usa o CNPJ 15.436.940/0001-03 e o Seller ID da conta vinculada. Para entregar ao e-mail intermediado pela Amazon, o remetente de produção do Resend precisa estar autorizado na comunicação da conta de vendedor. [Orientação fiscal da Amazon](https://m.media-amazon.com/images/G/32/FBA_BR_20/NovasRegrasSEFAZ.pdf) · [Permissões de e-mail no Seller Central](https://sellercentral.amazon.com.br/gp/help/external/G201054220)

## Publicação e liberação

1. Na PR, valide as regressões fiscais com PostgreSQL isolado, o build e a prévia. A prévia não transmite à SEFAZ de produção.
2. Aplique as migrations fiscais via Prisma e confira o histórico de migrations. A criação das tabelas não ativa o emissor. A numeração da homologação não participa do cálculo.
3. Confira XMLs de saída, cancelamentos, denegações, inutilizações e números pendentes em todos os emissores. A série 2 começa em 1 quando os históricos interno e externo estão vazios. A configuração considera o maior número de ambos e preserva o avanço do contador.
4. Registre a aprovação de cada SKU e a conciliação em uma sessão administrativa com acesso ao banco. Execute `bun scripts/nfe-real-configurar.ts /caminho/evidencia.json`. A operação `aprovar-sku` recebe `regraId`, `sku`, `referenciaContabil`, `aprovadoParaProducao` e `baseZeroCst49`. A operação `conciliar-serie` recebe `maiorNumeroExterno`, `referenciaNumeracao`, `referenciaContabil` e `confirmadaExclusividade`. Os campos de referência identificam a manifestação real da contabilidade e a conferência do histórico. Guarde as evidências com acesso restrito.
5. Confira em Production as configurações protegidas do A1, Resend, remetente em `RESEND_FROM_EMAIL` (com suporte ao remetente de convites existente) e autenticação do cron. Para Amazon, configure também `NFE_AMAZON_CNPJ_INTERMEDIADOR` com o dado aprovado e use a conta de vendedor já vinculada. Depois da validação e das aprovações, habilite `NFE_REAL_HABILITADA` e publique a configuração em ambiente comercial autorizado. O envio manual pode ser habilitado separadamente por `NFE_EMAIL_MANUAL_ENABLED=true` (Production). Mantenha `NFE_EMAIL_AUTOMATICO_ENABLED` desativada enquanto não houver agendador validado. A validação final dos dados comerciais e da assinatura ocorre por venda.

## Retornos e documentos

- Em timeout, mantenha a mesma chave. Consulte o recibo quando houver. Sem recibo ou protocolo, uma consulta que devolva 217 pelo menos três minutos após a última tentativa permite retransmitir os mesmos bytes. As solicitações concorrentes são serializadas no PostgreSQL.
- Uma rejeição definitiva permite corrigir a nota com a mesma numeração. Respostas de duplicidade ou de conteúdo incompatível entram em conciliação. Os pedidos e os retornos ficam no histórico fiscal.
- A autorização exige ambiente, chave, digest do XML e protocolo correspondentes. Na mesma transação, o ERP grava o XML processado e enfileira o e-mail. O cron entrega XML e DANFE PDF pelo Resend. O identificador de idempotência é constante por nota. Entregas incertas fora da janela de reenvio exigem conferência no provedor.
- O cancelamento registra o evento 110111, a justificativa e o protocolo da SEFAZ. A ação exige confirmação de que não houve circulação. Em resposta incerta, consulte a chave antes de reenviar o mesmo evento. O XML original da NF-e é preservado.
- Em SP, desde 1º/11/2026, o operador pode registrar a quebra e prosseguir com a sequência. Na transição até março de 2027, a opção de inutilização transmite somente o número da reserva encerrada. Uma aceitação exige cStat 102, protocolo e correspondência da faixa, ano, emitente, série e ambiente. O número nunca volta à sequência.

## Referências

O XML da NF-e usa o PL 010h v1.03, publicado em 13/11/2026. O evento de cancelamento usa Evento_Canc_PL_v1.01. Os pontos de entrada de lote e processamento vêm do PL 009p, e a inutilização combina os pontos de entrada oficiais com o leiaute atualizado do PL 010d v1.03. Os pacotes e seus hashes são versionados para validação local.

[Esquemas oficiais do Portal Nacional](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D) · [Web services de SP](https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx) · [Comunicado paulista sobre inutilização](https://portal.fazenda.sp.gov.br/servicos/nfe/)

## Importação de documentos externos e envio manual

- A opção **Importar XML autorizado do Sebrae** é restrita ao administrador. Informe o arquivo nfeProc da venda selecionada. O vínculo exige o mesmo comprador (CPF/CNPJ confirmado independentemente), total, itens e quantidades. A autorização é consultada por mTLS na SEFAZ de produção. Não importe documentos de pedidos diferentes, nem use o próprio XML como única evidência de identificação do pedido.
- A importação não transmite NF-e, não modifica o estoque ou o financeiro e não dispara e-mail. Não altera o contador da série; a conciliação definitiva deve considerar todo o histórico. A chave e o número já vinculados não podem ser reutilizados. Emissão ou reserva existente exige tratamento administrativo.
- Para uma NF-e própria já autorizada, o botão **Enviar NF-e por e-mail** atua somente sobre a venda selecionada, com confirmação explícita. Reaproveita a fila e a chave de idempotência. A flag manual é independente do cron e fica desativada por padrão. As notas externas não entram nessa fila. Não há envio em Preview ou durante testes por essa ação.
- Testes de integração utilizam um PostgreSQL isolado, certificado de teste e respostas SEFAZ e Resend simuladas; não comprovam credenciais ou conectividade do ambiente comercial.
