# Auditoria documental — NFC-e Pet Moura setembro/2026 e NFS-e do novo sistema

**Apuração em 29/10/2026.** Arquivos recebidos da Matilha Prado: `Arquivos Fiscais - Setembro 2026.zip` e conversa com responsável pelo fiscal. Esta análise não substitui consulta on-line de autenticidade à SEFAZ-SP/Prefeitura nem parecer contábil.

## ZIP de setembro — XMLs reais

- SHA-256 do ZIP: `1d0d2567eaa5969058d69f505c6575c5eb86d9f7c59f06af7a6823e4dc61bb2f`.
- **8 XMLs únicos** (raiz `nfeProc`), todos de **NFC-e modelo 65**, **série 2**, **ambiente 1 — produção**, numerados **292 a 299**.
- Datas de emissão do pacote: **03/09/2026 a 12/09/2026**.
- Cada um possui `protNFe/infProt/cStat=100` e elemento XML `Signature`. Não foi feita verificação criptográfica independente da assinatura nem consulta viva à SEFAZ-SP.
- Total nominal de 8 notas: **R$ 680,30**; **8 itens fiscais**.
- Todos os 8 itens exibem **CFOP 5102**, **CSOSN 102**, grupo **PISOutr, CST 99**, e grupo **COFINSOutr, CST 99**, com `vBC=0.00`, `pPIS=0.0000`, `vPIS=0.00`, `pCOFINS=0.0000` e `vCOFINS=0.00` nos XMLs.
- NCMs encontrados: `39269090` (2 itens), `61130000`, `48115123`, `33079000`, `05119999`, `23091000`, `63014000`. A presença nos XMLs não aprova materialmente os enquadramentos.
- A NFC-e **297** identificada anteriormente no cupom fotografado também está presente neste lote: não deve ser contada de novo.

**Privacidade:** XMLs completos, dados de consumidores, chaves de acesso individuais, protocolos, senhas, e tokens CSC não foram incluídos no GitHub.

## Reconciliação histórica dos XMLs fornecidos

| Pacote | Modelo | Série | Números | Quantidade única | Total |
|---|---|---|---|---:|---:|
| Março de 2025 (2 ZIPs idênticos) | 65 | 2 | 62–72 | 11 | R$ 977,78 |
| Agosto de 2026 | 65 | 2 | 283–291 | 9 | R$ 674,25 |
| Setembro de 2026 | 65 | 2 | 292–299 | 8 | R$ 680,30 |
| **Somatório de XMLs fornecidos** | 65 | 2 | Períodos distintos | **28** | **R$ 2.332,33** |

- **Sem lacuna no intervalo 283–299** presente nos ZIPs de agosto e setembro (17 NFC-e).
- Entre março/2025 e agosto/2026 há períodos não enviados, portanto não inferir continuidade em todo o histórico.
- A **299 emitida em 12/09/2026** é a maior nota de modelo 65 da série 2 disponível nos XMLs recebidos, **não** necessariamente a última antes de descontinuar o Pet Moura. Solicitar XMLs posteriores, relatórios de cancelamento, inutilização e último número até migração; preferencialmente recuperar pelo SAE NFC-e SEFAZ-SP usando certificado protegido.
- **NF-e modelo 55** do Mercado Livre, série 1, segue controle independente; o banco havia identificado a NF-e 55 **1084** como maior número conhecido desse subconjunto, não como número global livre.

## Mudança de entendimento quanto à NFS-e

- Conforme esclarecimento da interlocutora em 29/10/2026, a **NFS-e de serviços nº 2, emitida em 26/10/2026**, foi um **teste realizado pela empresa do novo sistema**, não pelo Pet Moura/Zetta.
- O PDF apresentado em conversa exibe NFS-e da Prefeitura de São Paulo, prestador Matilha Prado, CCM, código municipal de serviço `08648`, banho + tosa, valor R$ 150,00, referência a **RPS nº 5, série 2**. Documento PDF pode exigir verificação de autenticidade e status no portal municipal. A palavra "teste" utilizada pela interlocutora **não demonstra que a nota foi emitida em ambiente de homologação**: confirmar situação e eventuais efeitos fiscais com contabilidade e no portal.
- **Não reemitir** a NFS-e nº 2, não migrar RPS 5 para sequência de NFC-e 65. NFS-e, NFC-e e NF-e devem ter fluxos e identificações isolados.
- A empresa não presta serviços de hospedagem; excluir essa atividade do escopo operacional, ainda que apareça em tabelas de referência.
- Configuração de NFS-e deve cobrir serviços de banho/tosa e os demais serviços que o cliente confirmar, com classificações aprovadas. Verificar Web Service municipal e leiaute vigente; em 27/10/2026 o município publicou manual Web Service NFS-e v3.4 e schemas referentes à reforma tributária.

## Pendências objetivas

1. **Karine/Aleksander**: XMLs NFC-e modelo 65 após 12/09/2026 até encerramento do Pet Moura, ou autorizar consulta/recuperação pelo SAE NFC-e. Confirmar cancelamentos e inutilizações; nota 299 não deve ser assumida como última.
2. **Empresa do novo sistema**: identificar qual fornecedor emitiu NFS-e nº 2, confirmar se está em produção e se há outras NFS-e/RPS ou cancelamentos, informar método de integração sem compartilhar segredos por chat.
3. **Contabilidade**: validar CST PIS/COFINS 99 (histórico) vs 49 (cadastro atual) por operação, CFOP/CSOSN/NCM, serviço 08648, ISS e eventuais IBS/CBS, sem presumir alíquotas zero.
4. **Desenvolvimento**: concluir homologação técnica por modelo (NF-e 55, NFC-e 65 e, se contratada, NFS-e), com XML/XSD atualizado, assinatura XMLDSig A1, numeração/idempotência, comunicação oficial, armazenamento de autorização/protocolo e DANFE correspondentes. Continuar bloqueando emissão em produção até validação de regras e testes; não importar notas antigas como novas vendas e não alterar estoque.

**Resultado desta alteração**: relatório técnico apenas, sem mudança nos registros do banco, vendas, notas ou estoque.