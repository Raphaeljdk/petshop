# Auditoria da classificação fiscal Buddy Nutrition — 22/10/2026

## Natureza da alteração

Atualização controlada do catálogo **real** Matilha Prado, realizada com autorização do responsável. Não foram criadas regras tributárias, notas fiscais, alíquotas, CFOPs ou CSOSNs.

**Fontes**:
- Fotografia do DANFE de compra enviada pelo responsável na conversa de 22/10/2026, seção “Dados dos Produtos/Serviços”. Nas linhas correspondentes constou **NCM 23099090** (classificação usada pelo fornecedor); a fotografia NÃO é o XML original e não substitui sua conferência.
- Fichas de outros fornecedores com apresentação e EAN/GTIN coincidentes (links abaixo).

**Atenção**: a classificação do fornecedor é uma evidência, não homologação tributária para a Matilha Prado. Ela deve ser conferida à luz da NCM vigente e composição real. Todos os campos CFOP, CSOSN e CST PIS/COFINS permaneceram pendentes. O emissor próprio segue bloqueado.

## Alterações em Produto.ncm e Produto.gtinFiscal

| SKU | Apresentação identificada | Registros | NCM da foto | Fonte para identidade |
|---|---|---:|---|---|
| 7899732113897 | Buddy Nutrition Multi Funcional 8 em 1 168 g | 1 | 23099090 | https://app.hiperzoo.com.br/suple-buddy-nutrition-multif-em-g-34665 |
| 7899732113910 | Buddy Nutrition Digestão & Flora 168 g | 2 | 23099090 | https://www.hiperzoo.com.br/suple-buddy-nutrition-digest-flora-g-34664 |
| 7899732116690 | Buddy Nutrition Tranquilo & Calmo 168 g | 2 | 23099090 | https://www.hiperzoo.com.br/suple-buddy-nutrition-tranqu-calmo-g-34667 |
| 7899732118427 | Buddy Nutrition Ossos & Articulações pouch 30 un / 84 g | 2 | 23099090 | https://www.hiperzoo.com.br/suplemento-buddy-nutrossos-e-artic-g-36140 |
| 7899732118434 | Buddy Nutrition Tranquilo & Calmo pouch 30 un / 84 g | 2 | 23099090 | https://www.hiperzoo.com.br/supl-buddy-nutr-tranquilo-e-calmo-g-36141 |

**9 registros** atualizados apenas quando `ncm` e `gtinFiscal` estavam vazios; correspondência por SKU, nome e apresentação.

### Adição exclusiva de GTIN (NCM mantido pendente)

| SKU | Apresentação | Registros | Fonte |
|---|---|---:|---|
| 7899732118144 | Pele & Pelagem 168 g / 60 unidades individuais | 2 | https://www.autelie.com/produtos/buddy-nutrition-suplemento-168g-pele-e-pelagem/ |
| 7899732118410 | Pele & Pelagem pouch 30 un / 84 g | 2 | https://www.hiperzoo.com.br/supl-buddy-nutrition-pele-e-pelagem-g-36139 |

**4 registros** tiveram somente GTIN confirmado. O anúncio “2x60 tabletes” não foi alterado, porque a unidade comercial do kit pode ter GTIN próprio.

## Pendências e critérios de segurança

1. Obter o **XML original** da nota de compra para confirmar NCM e identificação exata de cada item.
2. Validar NCM e CFOP/CSOSN/PIS/COFINS com o contador, por produto e operação.
3. Para outros produtos, pesquisar por GTIN e documentação do fabricante/fornecedor; não copiar um NCM de categoria genérica.
4. Conferir diferenças de apresentação/embalagem; não propagar GTIN a kits ou variações sem conferência.
5. Não copiar o CFOP 6102, CST 000 ou a alíquota de ICMS 12% do fornecedor para notas de saída do Simples Nacional.
6. Permanecem pendentes assinatura do XML, validação no XSD e autorização de homologação.

### Referências oficiais

- Classificação fiscal de mercadorias: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/consultas
- NF-e e Simples Nacional: https://www.nfe.fazenda.gov.br/portal/perguntasFrequentes.aspx?tipoConteudo=S%2FEAGUrzRyk%3D
- ICMS-ST em São Paulo, alteração com vigência em 01/08/2026: https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-20-de-2026.aspx

Este documento é registro de proveniência, não um parecer de enquadramento definitivo.
