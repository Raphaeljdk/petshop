# Auditoria fiscal — Pet Moura, março de 2025 (dois ZIPs idênticos)

**Data da análise:** 28/10/2026. **Origem:** arquivos recebidos diretamente na conversa.

## Identificação das duas remessas

- `ArquivosFiscais (4).zip` — SHA-256: `989c7e4bfb4058a501e940a12dea5143c29a77706e71d546e27ff831fd25a0dd`.
- `ArquivosFiscais (4)(1).zip` — **mesmo SHA-256** e mesmos 11 XMLs, bit a bit. São **duplicações de envio**, não mais 11 notas.
- **Total único desta remessa: 11 documentos fiscais.**
- Os XMLs originais, CPFs, chaves de acesso completas e protocolos individuais **não foram adicionados a este repositório**.
- Leitura da estrutura e dos códigos de retorno no XML, **sem verificação criptográfica independente de XMLDSig, sem consulta ao servidor SEFAZ e sem validação com XSD**.

## Dados históricos confirmados por leitura de XML

| Propriedade | Resultado |
|---|---|
| Raiz | `nfeProc` |
| Modelo | **65, NFC-e** (não é NF-e modelo 55) |
| Série | **2** |
| Emissão | **01/03/2025 até 29/03/2025** |
| Números nos XMLs | **62 a 72**, consecutivos no pacote |
| Ambiente | **1 — produção** |
| Operação | `tpNF=1`, `idDest=1`: saída interna |
| Emitente | Mesmo CNPJ emitente identificado no lote de agosto de 2026 |
| Autorização documentada | **11/11** com `protNFe/infProt/cStat=100`, `nProt` e elemento `Signature` |
| Itens de mercadoria | 13 |
| Soma dos valores de NF (`vNF`) | **R$ 977,78** |
| Cancelamentos | Nenhum evento incluído no ZIP; **não comprova inexistência** |
| GTIN | `SEM GTIN` em todos os 13 itens |
| CEST | Não preenchido nesses 13 itens |

### Tributação observada nos 13 itens

- CFOP: **5102** em todos.
- ICMS: grupo **ICMSSN102**, CSOSN **102**, origem conforme XML em todos.
- PIS: **PISOutr**, CST **99**, `vBC=0.00`, `pPIS=0.0000`, `vPIS=0.00` em todos.
- COFINS: **COFINSOutr**, CST **99**, `vBC=0.00`, `pCOFINS=0.0000`, `vCOFINS=0.00` em todos.
- NCMs utilizados: `61130000` (5 itens), `33061000` (1), `23091000` (3), `33051000` (1), `42010090` (2), `61149010` (1).
- Estes NCMs e CSTs são **o histórico de 2025**, não uma aprovação fiscal para 2026/2027; a classificação e incidência material precisam ser avaliadas pelo contador por mercadoria e operação.

### Conciliação com remessa anterior (agosto de 2026)

| Lote recebido | Modelo | Série | Numeração disponível | XMLs únicos | Itens | Total |
|---|---|---|---|---:|---:|---:|
| Março/2025 — estes dois ZIPs idênticos | NFC-e 65 | 2 | 62–72 | **11** | 13 | R$ 977,78 |
| Agosto/2026 — arquivo anterior | NFC-e 65 | 2 | 283–291 | **9** | 11 | R$ 674,25 |
| **Lotes combinados** | **NFC-e 65** | **2** | Intervalos distintos, não contínuos entre 2025 e 2026 | **20** | **24** | **R$ 1.652,03** |

- A foto enviada anteriormente indica NFC-e **297**, série **2**, em **11/09/2026**. Essa nota **não está em nenhum dos ZIPs analisados**.
- A existência de XMLs nº **62–72 em março/2025**, **283–291 em agosto/2026** e foto nº **297 em setembro/2026** **não permite inferir o último número válido**. Há períodos intermediários sem histórico recuperado; exigir conciliação de todas as notas e faixas inutilizadas.
- O ERP contém NF-e modelo **55**, **série 1**, do Mercado Livre, com número conhecido até **1084** conforme consulta anterior; os números de NFC-e **65**, série 2, **não são intercambiáveis** com o modelo 55.
- Ambos os lotes históricos de NFC-e usam **PIS/COFINS CST 99** e grupos `Outr`, enquanto há **CST 49** cadastrado atualmente no ERP/Zetta. O dado histórico não fundamenta trocar **49 por 99** nem copiar alíquotas/bases zeradas. Pedir validação do contador por operação e período.

## Pendências para implementar emissores próprios

1. **NFC-e 65 (varejo)**: numeração separada do modelo 55, sequência/conciliação fiscal, XML homologação, assinatura XMLDSig, XSD vigente, Web Services, regras fiscais aprovadas, protocolo/DANFE NFC-e e contingência quando aplicável.
2. **NF-e 55 (vendas online)**: continuar desenvolvimento e teste independente da NFC-e, com número/série e destinatário adequados.
3. **Serviços (banho/tosa)**: documentos enviados não contêm NFS-e; conforme informação da cliente, antigo sistema emitia apenas cupom/extrato de serviços. Validar com contabilidade emissão da **NFS-e** adequada.
4. **Dados faltantes**: solicitar à Karine/Aleksander XMLs ou relatório fiscal posteriores a **agosto de 2026**, especialmente setembro e outubro; confirmar todas as emissões, cancelamentos, inutilizações e atuação de cada emissor por modelo/série.
5. **Segurança**: estes XMLs históricos não devem gerar novas vendas nem notas ou atualizar estoque; conteúdo pessoal e fiscal integral deve permanecer fora do GitHub.

**Status:** análise histórica documental. Nenhuma emissão/consulta online foi feita; nenhum dado do banco ou código do emissor foi alterado nesta documentação.
