# Central fiscal Matilha Prado — Todos os canais

## Objetivo
Um único painel por CNPJ para pedidos do site, Amazon, Mercado Livre e balcão/Hub. Documentos diferentes permanecem juridicamente distintos:
- `site`, `amazon`, `mercadolivre`: NF-e 55 na venda de mercadorias, quando aplicável.
- `loja`: NFC-e 65 para varejo presencial quando a legislação permitir/exigir, ou NF-e quando a operação demandar.
- Serviços como banho, tosa ou hospedagem podem exigir NFS-e e não devem ser tratados como vendas de produtos.

## Implementado
1. Botão **Emitir nota** em todos os pedidos; ele chama `POST /api/admin/fiscal/validar` e abre um checklist **sem enviar nada para a SEFAZ**.
2. A checagem impede a confusão entre rascunho e NF-e real, identifica possíveis duplicações, NCM/tributação pendentes, dados do CNPJ e do destinatário.
3. Pedido Mercado Livre: botão separado **Consultar NF-e** verifica no Faturador, recuperando número/chave/XML/DANFE; se houver permissão fiscal liberada, o painel exibe uma etapa adicional de confirmação de emissão real.
4. Amazon: **Consultar notas FBA** obtém metadados via API Invoices v2024-06-19 do Brasil. API é **apenas FBA**, não cobre vendas FBM/merchant fulfilled nem emite NF-e. Dados não são vinculados automaticamente ao pedido sem identificar a operação corretamente.
5. Provedor universal: API `/api/admin/fiscal/provedor` verifica, com `POST`, credenciais Nuvem Fiscal por OAuth2 `client_credentials` (`empresa nfe nfce`) sem emitir notas e sem retornar tokens ao navegador.
6. Emissão real universal **ainda não implementada**. É proibido habilitar um endpoint de transmissão até existir payload fiscal válido (MOC), ambiente de homologação, testes com contador, conciliação de notas emitidas anteriormente e histórico de números/chaves.

## Setup do emissor universal
1. Cadastre conta empresarial na [Nuvem Fiscal](https://console.nuvemfiscal.com.br) e selecione plano conforme volume de NF-e, NFC-e e NFS-e.
2. No Console → **Credenciais de API**, crie um Client ID e Client Secret somente para o CNPJ Matilha Prado.
3. Adicione em Vercel → Projeto petshop → Settings → Environment Variables (Production) sem expor valores no GitHub/chat:
   - `NUVEM_FISCAL_CLIENT_ID`
   - `NUVEM_FISCAL_CLIENT_SECRET`
4. No provedor fiscal, cadastre a empresa e configure o certificado A1, que deve ser enviado diretamente ao provedor. **O A1 cadastrado no Mercado Livre/Mercado Pago não transfere automaticamente para Nuvem Fiscal.**
5. Configure NF-e do CNPJ por ambiente, regime tributário real e demais códigos conforme contador.
6. No ERP → Fiscal e Notas → **Testar conexão fiscal**. Esperado: autenticação validada; nenhuma NF-e enviada.
7. Para tornar a emissão central realmente operacional ainda falta:
   - Gerar o JSON NF-e MOC com item, pagamentos, frete, CFOP por operação e tributos/IBS/CBS conforme regime vigente, revisados pelo contador.
   - Registro de destinatário/dados de entrega completos e estruturados; documento CPF/CNPJ é requerido em determinadas operações.
   - Validar numeração/série, chave, regras antifraude, estoque, valores totais e eventos de cancelamento.
   - Conectar o POST `/nfe` oficial e a consulta assíncrona com idempotência por venda e mecanismo de reprocessamento seguro, usando `referencia` única.
   - Sincronizar XML/DANFE oficiais em storage privado, controle de acesso e armazenamento pelo prazo legal.
   - Conciliação inicial dos documentos que já foram emitidos no Faturador ML e na Amazon, antes de qualquer emissão central.

## Como testar AGORA (sem emitir nada)
1. Faça login como ADMIN e abra **Fiscal e Notas → Pedidos e notas**.
2. Escolha venda de `site`, `amazon`, `mercadolivre` ou `loja`; clique em **Emitir nota**.
3. Confira que o painel aponta o modelo sugerido e apresenta ✓/pendências.
4. Confirme no DevTools (se necessário) que só foi enviado `POST /api/admin/fiscal/validar` com `vendaId`. Não existe POST real para SEFAZ/Nuvem Fiscal neste fluxo.
5. Repita com pedido cancelado, sem NCM e com rascunho já autorizado; nenhum deles pode liberar emissão.
6. Se a Amazon tiver função fiscal habilitada e o vendedor usar FBA, clique **Consultar notas FBA**; nenhum documento fiscal será emitido.
7. Para o Mercado Livre, primeiro clique **Consultar NF-e** de pedido que já tem nota. As permissões fiscais da aplicação precisam estar corretas. Não libere `MERCADO_LIVRE_NFE_EMISSAO_HABILITADA` antes de validar os acessos e a primeira operação com o responsável contábil.

## Fontes oficiais
- https://dev.nuvemfiscal.com.br/docs/autenticacao/
- https://dev.nuvemfiscal.com.br/docs/empresas/
- https://dev.nuvemfiscal.com.br/docs/nfe/
- https://developer-docs.amazon.com/sp-api/docs/invoices-api-v2024-06-19-reference
- https://developers.mercadolivre.com.br/pt_br/registre-o-seu-aplicativo/api-fiscal-faturamento-de-venda
