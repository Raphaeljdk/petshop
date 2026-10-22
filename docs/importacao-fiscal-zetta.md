# Importação fiscal do Zetta — relatório de itens
O relatório de 13 páginas `itens.pdf` do ZettaPet Smart (22/10/2026) contém **Código/GTIN, descrição, NCM, preço, custo e estoque**. Não é uma exportação de NF-e nem contém alíquotas, CEST, CSOSN, CST PIS/COFINS ou regras fiscais de saída.

## Procedimento seguro
1. No Zetta, exporte a lista de itens com GTIN, NCM, CEST e origem para CSV UTF-8. Se houver só PDF, transcreva de forma controlada e revise diferenças de leitura.
2. Em **Fiscal e Notas → Tributação dos produtos**, escolha o CSV e clique **Conferir antes de importar**.
3. Corrija linhas com códigos inválidos, kits e NCMs divergentes. A busca usa o GTIN válido ou o vínculo histórico `pro_cod`. **Não vincula apenas pela descrição**.
4. Após revisão, confirme a importação. Somente campos vazios de **NCM, CEST, GTIN e origem** são preenchidos, com log de auditoria.
5. A classificação recebida do Zetta é uma referência documental, não validação oficial da NCM pela Receita.
6. A tributação de saída (CFOP, CSOSN, CST PIS/COFINS, IPI, ST, FCP, IBS/CBS etc.) depende do regime da Matilha Prado (CRT 1), produto, UF, destinatário e natureza da operação. Essas regras **não serão importadas automaticamente** de notas de compra.

## O relatório PDF enviado
- Contém 13 páginas, incluindo itens de serviço (banho/tosa), que não devem receber classificação de mercadoria para NF-e 55.
- Contém códigos de barras com zeros iniciais que devem ser preservados como **texto**.
- A leitura por OCR só produz **candidatos**; a prévia no ERP deve ser revisada e qualquer código duvidoso comparado visualmente ao PDF.
- Não sincroniza ou ajusta estoques, custos, preços ou anúncios.
- Não habilita emissão fiscal. NF-e real continua dependendo de XSD oficial, assinatura A1, credenciamento/homologação e regra tributária revisada.

## Modelo
`docs/modelo-importacao-fiscal-zetta.csv` apresenta as colunas aceitas. Campos fiscais não presentes no documento devem ficar vazios.
