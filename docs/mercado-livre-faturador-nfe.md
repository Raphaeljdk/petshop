# Emissão real de NF-e — Faturador Mercado Livre

Implementação em `src/lib/mercado-livre-fiscal.ts`, `/api/admin/fiscal/mercado-livre` e `/api/admin/fiscal/mercado-livre/documento`.

## Fontes oficiais

- Emissão: https://developers.mercadolivre.com.br/pt_br/registre-o-seu-aplicativo/api-fiscal-faturamento-de-venda
- Consulta e XML/DANFE: https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/obtendo-nota-fiscal
- Permissões funcionais: https://developers.mercadolivre.com.br/pt_br/permissoes-funcionais/

## Funcionamento

1. A integração OAuth Mercado Livre existente recupera token e identifica sellerId. Não solicitamos certificado A1 ao ERP: o certificado já está no Faturador.
2. Apenas `ADMIN` pode consultar e emitir. Todas as requisições POST validam a mesma origem.
3. A ação **Consultar NF-e** chama `GET /users/{sellerId}/invoices/orders/{orderId}`, identifica a NF-e, registra número, série, protocolo, chave e status (autorizada somente com chave de 44 dígitos e protocolo).
4. **Emitir NF-e** só funciona para venda importada do canal `mercadolivre`, concluída, com identificação de pedido válida e sem documento pré-existente. Recheca o estado na API do ML, compara vendedor e pagamento, bloqueia `pack_id` (carrinhos precisam faturamento conjunto) e exige confirmação humana.
5. Lock atômico `rascunho -> emissao_solicitada` antes do POST para impedir duas requisições locais simultâneas.
6. POST de emissão: `POST /users/{sellerId}/invoices/orders` com `{ "orders": [123456789] }`. **Não há retentativa automática**: erros ou timeout marcam `pendente_confirmacao`, exigindo conciliação.
7. XML e DANFE são baixados por proxy autenticado somente após consulta confirmar documento autorizado. URL de origem é validada e fixada ao host oficial, evitando redirecionamento/SSRF.
8. Ações fiscais para site/Amazon/presencial **não** usam essa API. Cada canal exige emissor e natureza tributária apropriados.

## Habilitação em Vercel

A variável `MERCADO_LIVRE_NFE_EMISSAO_HABILITADA` é **desativada por padrão**. Para ativar (somente depois dos testes fiscal e autorização operacional):

- Mercado Livre Developers → Sua aplicação → Permissões funcionais → **Faturamento**: habilitar leitura e escrita, se disponíveis para a conta. Reconectar OAuth se solicitado para atualizar concessões.
- Confirmar dados fiscais dos anúncios, emissão aprovada no Faturador, regime tributário, certificado A1 e regras do contador.
- Fazer testes de consulta com pedidos reais, incluindo um que já possui NF-e autorizada, uma venda não faturada e um carrinho.
- Verificar que nenhuma venda está com `emissao_solicitada` ou `pendente_confirmacao` aguardando conciliação.
- Adicionar em Vercel **Production** `MERCADO_LIVRE_NFE_EMISSAO_HABILITADA=true` e fazer um novo deploy somente após aprovação.
- Testar manualmente uma venda real previamente elegível, com acompanhamento do responsável fiscal. Uma emissão verdadeira tem consequências jurídicas.

## Limitações e precauções

- O Faturador Mercado Livre não emite automaticamente pedidos externos do site ou Amazon.
- Carrinhos/packs com múltiplas orders exigem emitir uma única nota para todas as orders do vendedor: a emissão individual é bloqueada; packs com uma única order são aceitos.
- O uso de XML para contabilidade exige armazenamento privado, backup e retenção apropriada; a API atual faz proxy do XML oficial sem persistir arquivo.
- Cancelamento na SEFAZ ainda **não** foi implementado.
- O botão de emissão real nunca deve ser disparado por efeito, cron, webhook ou abertura da tela. Sempre requer clique explícito.
- O status "authorized" sem número, chave de 44 dígitos e protocolo **não** vira "autorizada" no ERP, para evitar apresentação de documentação fiscal inválida.
