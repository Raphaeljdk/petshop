# Liberação protegida — estoque Matilha Prado · 22/11/2026

## Objetivo
Publicar em produção as correções da PR #163, incorporadas à `main` no commit `c8bca71499378b8be5731b4ca28845fe64272070`, com **envio automático de estoques para Mercado Livre e Amazon bloqueado**.

A Vercel deste projeto usa uma regra explícita de release: somente commits cuja mensagem contém `[release]` são compilados em produção. Esta nota autoriza o commit sinalizado, sem desativar a regra de Ignored Build Step.

## Entradas obrigatórias verificadas
- Compilação, autenticação, privacidade e testes de estoque da PR #163 concluídos com sucesso.
- Variável `MARKETPLACE_STOCK_WRITES_ENABLED` definida em **false** no ambiente de produção (não ativar).
- O Hub é a referência para saldo físico: leituras da loja não reimportam estoque Zetta/Siggma; novas importações de catálogo não abastecem estoque físico.
- Estoque dos anúncios pausados não é reativado automaticamente por sincronização.
- Cadastro com SKU duplicado ou ASIN ambíguo deve permanecer bloqueado para escrita externa.

## Homologação pós-publicação
1. Confirmar deploy `READY`, commit `[release]` e domínio `www.matilhaprado.com.br`.
2. Validar login, home e catálogo público/cliente; recarregar a página não deve alterar `Produto.estoque`.
3. Verificar no painel **Integrações** o aviso `stockWritesEnabled=false`.
4. Conferir os totais de produto e estoque no Neon antes e depois do deploy; deploy não pode alterar saldos por si só.
5. Conferir exportação CSV da auditoria de 156 grupos de SKU e os três ASINs em duplicidade.
6. Não ativar escrita externa até a equipe conferir produtos físicos e executar teste controlado de leitura/escrita nas duas APIs.
7. Revisar as 14 vendas Mercado Livre com baixa pendente antes de qualquer reprocessamento.

## Pendências não encerradas
A publicação **não** equivale à conciliação física. Mantêm-se pendentes os cadastros duplicados, permissões de escrita no ML, confirmação da API Amazon e validação da disponibilidade após envio. Nenhuma quantidade deve ser inventada nem somada entre canais.
