# Auditoria técnica — NFC-e do Pet Moura, agosto de 2026

**Origem**: ZIP recebido em conversa, `Arquivos Fiscais - Agosto 2026.zip`, SHA-256 `3e7dda98ec0e5f1109d791ba282f93e915dcc12eb2acc7ec3ccc08ba10570423`.

**Importante**: arquivos XML originais **não foram adicionados ao repositório**. Este documento registra apenas resultados agregados; não inclui chaves de acesso, protocolo individual, dados pessoais ou XML bruto. É evidência de operações históricas, **não** autorização contábil para replicar os códigos em outras vendas.

## Identificação verificada por leitura de XML

| Propriedade | Evidência |
| --- | --- |
| Quantidade | 9 XMLs com raiz `nfeProc` versão 4.00 |
| Tipo | NFC-e, **modelo 65**, **não NF-e modelo 55** |
| Emitente | O mesmo CNPJ da Matilha Prado informado no ERP |
| Ambiente | `tpAmb=1` (produção) |
| Operação | `tpNF=1`, `idDest=1` |
| Série | **2** em todos os documentos |
| Numeração | **283 a 291**, consecutiva entre as notas do ZIP |
| Datas | 05/08/2026 a 31/08/2026 |
| Autorizações | 9/9 com `protNFe/infProt/cStat=100`; possuem `nProt` e elemento `Signature` |
| Total das 9 notas | R$ 674,25 |
| Total de itens fiscais | 11 |
| Eventos de cancelamento | Nenhum incluído nestes 9 arquivos; **não comprova inexistência de cancelamentos em outros períodos** |

## Tributação efetivamente observada em 11 itens

- CFOP `5102`: 11 de 11.
- Origem `0`, grupo `ICMSSN102`, CSOSN `102`: 11 de 11.
- PIS: grupo **`PISOutr`**, CST **`99`**, `vBC=0.00`, `pPIS=0.0000`, `vPIS=0.00`: 11 de 11.
- COFINS: grupo **`COFINSOutr`**, CST **`99`**, `vBC=0.00`, `pCOFINS=0.0000`, `vCOFINS=0.00`: 11 de 11.
- GTIN: `SEM GTIN` em todos os 11 itens.
- Não foi encontrado CEST nos 11 itens.
- NCMs presentes: `05119999`, `48115123`, `23091000`, `33051000`, `42010090`, `33079000`. Essas classificações **não foram validadas materialmente**.

**Divergência relevante**: cadastro fiscal atual da Matilha Prado contém PIS/COFINS CST **49**, mas os XMLs históricos do Pet Moura de agosto usaram CST **99**, embora ambos usem grupos `Outr` do leiaute. **Não alterar códigos nem copiar bases/alíquotas zeradas** automaticamente. Solicitar ao contador a regra para operação específica e vigência aplicável.

## O que estes documentos NÃO resolvem

1. A numeração da **NF-e modelo 55** utilizada no Mercado Livre é independente da NFC-e modelo 65. No ERP há números de NF-e 55 da **série 1**; não usar os números **283–291, série 2, modelo 65** para reservar NF-e 55.
2. A série 2, número 291, é **apenas a última do pacote de agosto**. A foto enviada na conversa mostra NFC-e **297, série 2**, de 11/09/2026; confirmar histórico completo até a data de migração, além de inutilizações e cancelamentos.
3. O XML de NFC-e de balcão não substitui uma venda com **NF-e modelo 55**, destinada aos cenários apropriados de venda online. Não reaproveitar automaticamente `mod=65`, `tpImp=4` ou `indPres=1` no emissor 55.
4. Conforme relato da cliente, o **banho** tinha cupom/extrato separado, **sem emissão de NFS-e pelo Pet Moura**. É necessário confirmar com a contabilidade o tratamento fiscal dos serviços e definir emissor **NFS-e** apropriado (se necessário) separado de NFC-e e NF-e.
5. `cStat=100` demonstra autorização histórica dos respectivos documentos; **não homologa o novo emissor próprio**.
6. O pacote não contém XMLs de **NF-e modelo 55** para preencher o exemplo de homologação desse modelo. A implementação da NF-e 55 permanece condicionada a regras fiscais aprovadas, XSD atualizado, XMLDSig, comunicação SEFAZ e tratamento de protocolo.

## Próximos documentos / confirmações

**Aleksander / Karine**: obter pacote de NFC-e setembro/outubro (se houver), ou relatório até o encerramento do Pet Moura; confirmar eventuais eventos, inutilizações e identificação de séries; informar como Mercado Livre/Amazon emitem NF-e modelo 55.

**Contador(a)**: validar os CSTs PIS/COFINS **49 vs 99** para cada operação, revisar códigos de NCM, CFOP, CSOSN, CEST/ST/IPI/FCP/IBS/CBS em 2026; orientar emissão de NFS-e dos serviços e confirmar numeração fiscal após a migração.

**Desenvolvimento**: manter o emissor próprio bloqueado; usar estes XMLs como referência **estrutural histórica somente de NFC-e 65**, implementando fluxos separados para NFC-e 65, NF-e 55 e eventual NFS-e. Não inserir XMLs históricos como novas vendas nem reemitir notas antigas.
