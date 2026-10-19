# Matilha Prado — transição para ERP próprio

## Alterações desta branch
- Clientes: o painel usa a tabela `Cliente` local, com cadastro e edição; nenhuma tela de clientes depende mais da listagem Zetta.
- Estoque oficial: `Produto.estoque` no PostgreSQL local. `estoqueHub` acompanha as movimentações; campos `estoqueZetta` e `zettaProCod` continuam **somente como legado** para auditoria.
- Mercado Livre e Amazon: importam catálogo como canais, sem reescrever o saldo local de produtos existentes; pedidos são registrados em `Venda`, com baixa local e idempotência por `marketplaceOrderId`.
- Bridge Zetta e API Siggma: bloqueadas para impedir novas consultas/gravações no ERP anterior.
- A edição e venda de produtos antes vinculados ao Zetta foi liberada.

## Pré-requisitos de publicação em produção (obrigatórios)
1. **Fazer backup do PostgreSQL** e exportar do Zetta todos os clientes, pets, produtos, SKUs, custos, notas e movimentos históricos.
2. Comparar o cadastro antigo ao local, deduplicando clientes por CPF/CNPJ ou e-mail e produtos por SKU **mais variação**. Importar faltantes; não criar novas identidades de clientes automaticamente para registros sem confirmação.
3. Conciliar fisicamente `Produto.estoque` com o inventário real, inclusive zero, antes de liberar novos pedidos. Nunca somar estoques de ML + Amazon + Zetta para um mesmo SKU.
4. Conferir se os produtos vinculados a dois marketplaces apontam para o mesmo SKU/variante local e se todos os pedidos recentes já existem em `Venda`.
5. Rodar testes de ponta a ponta em ambiente QA: cadastro/edição de cliente, venda local, webhook ML, pedidos Amazon, atualização de estoque em ambos os canais, repetição de pedidos e estoque insuficiente.
6. Após validar QA e o novo deploy, revogar credenciais e excluir no **ambiente Vercel** as variáveis `SIGGMA_*` e `INTEGRATION_BRIDGE_*`. Esta alteração de código não revoga credenciais remotas.
7. Manter backup do legado e arquivos fiscais pelo prazo legal aplicável. Não remover campos e tabelas legadas antes da migração concluída.

## Módulo fiscal planejado
- Nota principal para vendas online: **NF-e modelo 55**.
- NFC-e modelo 65: apenas operações de varejo interno permitidas pela SEFAZ.
- O documento fiscal **não determina por si só uma alíquota menor**.
- Antes de autorizar emissão de documentos reais: parametrizar CNPJ, IE, CRT, NCM, CEST, CFOP, CST/CSOSN, endereço, tributos, série, numeração, certificado A1, ambientes homologação/produção e contingência. Testar com contador.
- Registrar XML autorizado, protocolo, chave de acesso, cancelamentos e inutilizações de maneira auditável. Integrar com provedor fiscal/SEFAZ; **não emitir comprovante interno como se fosse documento fiscal**.

**Este PR não ativa a emissão de NF-e ou NFC-e.**
