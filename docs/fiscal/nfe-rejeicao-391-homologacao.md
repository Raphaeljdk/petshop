# Matilha Prado — correção cStat 391 (homologação)

## Fato observado em 17/11/2026
- NF-e modelo 55, ambiente de homologação, série 2, número 3: rejeitada com **cStat 391** (“Não informados os dados do cartão de crédito / débito nas Formas de Pagamento da Nota Fiscal”, nOcor 1).
- Consulta direta ao Neon mostrou `<tPag>17</tPag>` (Pix dinâmico), sem `<card>`. A rejeição decorreu da ausência do grupo de dados eletrônicos de pagamento, não de documento em homologação.
- `cStat 434` da nota número 2 foi corrigido anteriormente por `indIntermed=0`, que já está presente na nota 3.
- Nota 1 continua com situação **incerta**. Não a declarar autorizada sem protocolo.

## Alteração
- Para `tPag=17`, o gerador requer `dadosPagamento.tipoIntegracao` explícito e inclui `<card><tpIntegra>...</tpIntegra></card>` na posição do XSD; tipo 1 exige CNPJ da instituição e identificação real da transação.
- Na preparação **fictícia** de homologação foi definido `tipoIntegracao=2` (Pix não integrado). Isso não cria ou representa um pagamento real, não autoriza usar tipo 2 em produção quando a transação for integrada.
- Não alterar o XML nem o status de notas rejeitadas; a correção vale para **novas NF-e** de teste, com outra chave, série 2.
- Nunca inventar CNPJ de adquirente, autenticação de cartão ou endToEndId de Pix. Produção precisa identificar corretamente o pagamento verdadeiro, a instituição, o tipo de integração e os dados exigidos.
- O build automatizado usa XSD oficial 010g, assinatura e testes de fluxo; validação XSD isolada não comprova aceitação da regra de negócio da SEFAZ.

## Próxima etapa
1. Consultar a chave da NF-e série 2 número 1, que tem status incerto.
2. Preparar e assinar novo teste com numeração isolada e validar XML assinado contra XSD.
3. Transmitir **somente homologação** e verificar `cStat 100`, `nProt` e XML autorizado.
4. Não habilitar NF-e própria de produção, movimentar estoque, emitir para pedido real ou enviar e-mails de documentos sem autorização.

## Referências
- NT 2023.004, regra YA04-10 e grupo de pagamento eletrônico: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?AspxAutoDetectCookieSupport=1&conteudo=hoSIJ5lGBNc%3D
- Exemplo de Pix não integrado e grupo card: https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360010236774

## Validação e publicação
- PR #150 integrada após aprovação dos três workflows GitHub Actions: Release build, Authentication checks e Client invitation checks.
- A publicação do código não equivale a transmitir NF-e nem obter autorização da SEFAZ. A próxima NF-e de homologação deverá usar novo número, sem alterar a rejeitada número 3.
