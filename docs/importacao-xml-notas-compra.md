# Matilha Prado — importação fiscal de NF-e de entrada (XML)

## Onde usar
**Administração → Fiscal e Notas → Classificação fiscal dos produtos → Importar notas de compra dos fornecedores.**

1. Solicitar ao fornecedor o **XML da NF-e modelo 55 autorizada** da compra (não DANFE em PDF, recibo, NFC-e ou NFS-e).
2. Cadastrar corretamente o **CNPJ da Matilha Prado** na aba **Emitente** do ERP.
3. Selecionar até 8 arquivos \`.xml\` por vez, cada um de até 900 KB, e clicar em **Analisar XMLs**.
4. Conferir o fornecedor, chave de acesso, protocolo de autorização e prévia dos produtos.
5. Itens associados por GTIN válido podem receber **NCM, CEST e GTIN que estejam vazios**.
6. Itens sem vínculo podem ficar pendentes, ser vinculados manualmente a um cadastro existente ou dar origem a um **produto novo inativo** (estoque 0 e preço 0).
7. Marcar a confirmação e aplicar uma NF-e por vez; conferir o resultado e os registros de auditoria.

## Regras de segurança
- Somente administrador autenticado pode simular/aplicar; escrita protegida contra requisições de outra origem.
- XML só de **NF-e modelo 55** com emitente e destinatário CNPJ, operação de saída do fornecedor e **destinatário igual ao CNPJ do cadastro da Matilha Prado**.
- XML autorizado em **produção** com protocolo correspondente à chave para gravação; XML de teste serve apenas para prévia.
- DTD e entidades externas recusadas; entrada limitada por tamanho, profundidade e quantidade de produtos. Não há consultas de rede pelo parser.
- Nunca importar automaticamente CFOP/CSOSN/CST/PIS/COFINS/IBS/CBS, alíquotas, valores, custos, movimentações de estoque, vendas ou NF-e emitidas.
- Nada é sobrescrito: NCM, CEST e GTIN já existentes permanecem; divergências são listadas para conferência.
- GTIN/EAN requer dígito verificador válido. Não usar nome comercial ou código interno do fornecedor como vínculo automático.
- Kit/combo diferente da unidade e GTIN repetido são bloqueados para revisão.
- O processamento aplica alterações e histórico de auditoria em uma transação, com trava por chave para evitar importações concorrentes da mesma nota. A NF-e importada não pode ser aplicada de novo.
- A importação grava um registro em \`ImportacaoFiscalProduto\` (fonte \`XML_NFE_ENTRADA\`, arquivo = chave NF-e, hash do XML, número do item e campos alterados).
- Sem mudanças no schema ou migrações: utiliza o histórico de auditoria já existente.

## Limitações conhecidas e próximas evoluções
- O leitor extrai dados do XML para **assistência cadastral**, mas **não substitui validação XSD nem consulta SEFAZ**. A autorização é inferida a partir do protocolo presente no XML: um arquivo adulterado pode simular esse conteúdo. A origem/autenticidade de documentos deve ser conferida com o fornecedor ou serviço oficial antes de aplicar; uma futura integração DF-e poderá verificar diretamente na SEFAZ.
- Ainda não faz consulta automática das NF-e destinadas ao CNPJ (distribuição DF-e); somente upload manual de XML.
- Ainda não lança entradas de mercadorias, custo médio, inventário, contas a pagar ou fornecedores. Esses fluxos serão operações independentes, com aceite explícito.
- Não cria produtos ativos: novos registros exigem revisão de categoria, preço e estoque antes de serem disponibilizados para venda.
- Itens sem GTIN podem ser cadastrados como novos inativos por seleção explícita; entre documentos diferentes ainda podem necessitar unificação manual para evitar cadastros semelhantes.
- Se uma NF-e tiver campos divergentes, confirmar com a contabilidade e corrigir no cadastro fiscal pela tela própria. NCM do fornecedor é referência, não garantia de enquadramento correto de revenda.
- Documentos de devolução, cancelados, outros modelos, ou em nome de outro destinatário ficam fora do escopo.

## Verificação
- \`bun test tests/fiscal-xml-entrada.test.ts\`
- \`bun run lint\`
- \`bun run typecheck\`
- Validar fluxo ponta a ponta com XML de compra verdadeiro e autorização da Matilha Prado, **sem alterar estoque**.
