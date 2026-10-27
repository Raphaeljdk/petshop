# Primeira NF-e 55 da Matilha Prado — plano de homologação (27/10/2026)

Este plano distingue **dado registrado** de **tratamento aprovado pela contabilidade**. O painel GET `/api/admin/fiscal/homologacao/preparo` é ADMIN, somente leitura; não cria pedidos, não reserva número, não transmite XML ou altera estoque.

## Dados do ambiente existentes (verificados no Neon em 27/10/2026)

- Empresa cadastrada em CRT 1, UF SP, série 1 e preferência de **produção**. A preferência não habilita NF-e própria.
- No ERP há cinco NF-e modelo 55 autorizadas por `mercado_livre` com números 946, 1069, 1077, 1078 e 1084 na série 1. **1084 não é necessariamente a última nota de todos os emissores e 1085 não deve ser reservada automaticamente**.
- Há 106 rascunhos de NF-e 55, sem número reservado. Podem ser de operações reais importadas; não movimentar/apagar automaticamente.
- Existem zero regras em `RegraFiscalAprovada` com validação contábil.
- Certificado A1 protegido já configurado em Vercel; comunicação TLS homologação testada anteriormente. **Essas verificações não provam assinatura XMLDSig nem NF-e autorizada**.
- Produto de estudo: Brinquedo Bola Resistente Cães Strong Ball Pequena Jambo Pet Laranja; SKU e GTIN `7899669611657`; NCM cadastrado `39269090`; CFOP cadastrado `5102`; CSOSN `102`; CST PIS e COFINS `49`, origem `0`, unidade `UN`, CEST ausente. Existe um anúncio ativo, além de anúncios inativos espelhados. Todos esses códigos são **candidatos à conferência, não aprovados**. Valor, estoque e vendas não serão utilizados neste teste preparatório.

## Solicitação para a contabilidade

1. Confirmar CRT 1, IE, município e credenciamento NF-e 55 em SP, homologação e produção, além da NF-e de teste para consumidor final não contribuinte dentro de SP.
2. Revisar **material e classificação** da bola Strong Ball e confirmar NCM `39269090`, origem, GTIN, possível CEST, ICMS-ST e FCP.
3. Confirmar CFOP `5102` e CSOSN `102` para a operação delimitada, ou indicar enquadramento diferente com justificativa.
4. Validar PIS e COFINS CST `49` de saída, base, percentual e valor/grupo XML, ou corrigir classificação; também IPI/IBS/CBS 2026 quando exigidos. Não substituir 49 por 04–09 apenas para burlar validações do XML.
5. Registrar regra aprovada por NCM + CFOP + origem + UF destino SP + indicador IE 9, período vigente, referência e nome do profissional responsável na aba de regras revisadas.
6. Confirmar histórico de série/numeração de todos os emissores e recomendar estratégia para preservar sequência sem duplicidade.

## Pedido para Aleksander/financeiro

- Exportar do Zetta (e outros emissores) o **XML das NF-e modelo 55 de SAÍDA**, e a lista com chave de acesso, série, número, data, status (autorizada, cancelada, denegada quando aplicável), inutilizações e protocolo de autorização. Não confundir com XML de compra/entrada.
- Informar se Mercado Livre e Amazon continuam emitindo notas pela mesma série 1, inclusive eventuais emissões não importadas no ERP.
- Confirmar nome e embalagem física do produto Strong Ball Pequena Laranja, sem abrir venda nova nem ajustar estoque.
- Enviar arquivos por canal restrito; não compartilhar senha ou arquivo P12/PFX por WhatsApp/chat.

## Tarefas técnicas para o desenvolvimento no Work

1. Manter produção bloqueada. Criar módulo **somente homologação** (`tpAmb=2`) independente de pedidos reais, com namespace isolado: sem criar `Venda`, `ItemVenda`, `NotaFiscal` de produção nem debitar estoque.
2. Após aprovação contábil, implementar grupos PIS/COFINS corretos (inclusive `PISOutr`/`COFINSOutr` se CST 49 confirmado) com **bases/alíquotas/valores explicitamente aprovados**, jamais inventar zero.
3. Usar XSD oficial corrente do Portal Nacional (`PL_010f`, publicado 31/08/2026, conferir pacotes novos na data de uso). Validar campos, grupo IBS/CBS aplicável em 2026, arredondamentos e chave.
4. Assinar `infNFe` com XMLDSig enveloped por biblioteca XML segura e auditada, usando A1 exclusivamente no servidor sem exportar chave, e verificar assinatura; mTLS não equivale à assinatura.
5. Consumir SEFAZ-SP homologação `NFeAutorizacao4`, `NFeRetAutorizacao4` quando aplicável e `NFeConsultaProtocolo4`; idempotência, timeouts, reconciliação e logs sem segredos.
6. Guardar XML assinado, resposta, cStat, chave e protocolo de **homologação** em armazenamento separado, com controle de numeração e correlação de testes. Em caso de status incerto, consultar protocolo antes de reenvio.
7. Exigir acesso ADMIN, confirmação explícita e resultado de prévias XSD/assinatura bem-sucedidos antes de transmitir **qualquer** XML, ainda que em homologação; primeiro relatório seco/dry-run.
8. Testar rejeições, cancelamentos/inutilização conforme regras, totalizadores e DANFE, sem misturar com vendas Mercado Livre/Amazon.
9. Somente após autorização homologada (por exemplo cStat 100) e revisão com contador, planejar liberação de produção, que segue dependente de aprovações e testes separados.

## Referências oficiais

- Esquemas XML: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w=
- URLs serviços SEFAZ-SP: https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx

**Status do sistema na entrega deste plano**: prévia de preparo implementada; assinatura, XSD, autorização própria e protocolo ainda não implementados. Não alegar NF-e real autorizada.
