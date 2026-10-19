# Matilha Prado — Emissão fiscal por venda e tributação responsável

## Pedido do cliente (áudios de 19/10/2026)
1. Abandonar a necessidade operacional de reunir várias vendas em uma única nota de fechamento mensal.
2. Emitir documento fiscal individual correspondente a cada venda conforme legislação e regras do contador.
3. Avaliar o Sistema de Gestão Mercado Pago (que emite NF-e/NFC-e) como alternativa; investigar formalmente a existência de API pública apropriada.
4. Estudar carga tributária por canal, tipo de produto, estado e regime. Não tratar venda feita pelo tablet como venda online de menor imposto.
5. Produtos: NF-e 55 e NFC-e 65 se permitido. Serviços: avaliar NFS-e separadamente, não misturar com notas de mercadorias.

## Implementado com segurança
- Rascunho local idempotente para vendas online concluídas (site), webhooks de pagamentos aprovados e pedidos de marketplaces. Vendas administrativas presenciais (`loja`) aguardam o módulo NFC-e e não recebem rascunho de NF-e automaticamente.
- Uma venda não gera mais de um registro de nota. Reenvios de webhook não duplicam.
- Falhas ao criar rascunho não anulam pagamento/venda: operador pode usar ação manual na aba Fiscal e Notas.
- A emissão autorizada por SEFAZ **não** foi implementada. Nenhuma chave, XML, DANFE, protocolo, número ou suposta autorização é inventada.
- Para pedidos Mercado Livre/Amazon que já tenham sido faturados fora do ERP, conferir chave/XML externo antes de emitir novamente.

## Verificações antes de habilitar emissão real
- Contador: regime CRT, CFOP, NCM/CEST, CST/CSOSN, ICMS/ST/monofásico, DIFAL, obrigações estaduais e regras atualizadas IBS/CBS.
- Credenciamento SEFAZ, certificado A1, dados emitente, autorização e testes em homologação; NFS-e para serviços quando aplicável.
- Confirmar com o Mercado Pago se o Sistema de Gestão oferece **API pública documentada para emitir e consultar NF-e**, não apenas API para pagamentos/webhooks. Blog divulgando 'integração' não prova que o endpoint está disponível.
- Caso não haja API de emissão, contratar/implementar provedor fiscal autorizado separado. Não usar endpoints inventados.
- Armazenar XMLs e DANFEs oficiais em storage com acesso restrito, backups, logs de auditoria e retenção fiscal apropriada.
- Para grande volume: fila persistente para autorização/consulta, retry com idempotência, status por pedido e alertas; **não transmitir NF-e dentro do webhook de pagamento**.
- Emissão pode depender do estado e da natureza do fato gerador; não supor que pagamento confirmado sozinho define o momento correto.
- Verificar se as operações locais exigem NFC-e e se a empresa também presta serviços distintos das mercadorias.

## Tributação
A diferença entre NF-e e NFC-e ou entre venda num tablet e loja física **não altera automaticamente as alíquotas**. Qualquer economia deve decorrer de enquadramento e segregação fiscal corretos, revisados pela contabilidade. Não inventar modalidade online para transações presenciais.
