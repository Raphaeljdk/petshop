# Matilha Prado — conferência do estoque anunciado x estoque físico

## Diagnóstico em 16/11/2026
- No banco de produção: 40 anúncios do Mercado Livre com quantidade anunciada > 0 e estoque físico ERP = 0.
- Exemplo real: Refil Cata Caca 30 sacos, quantidade anunciada 1.000 e saldo ERP 0. Não é seguro transformar 1.000 em estoque físico sem conferência.
- Dos produtos vinculados ao Mercado Livre, praticamente todos com saldo físico positivo estão publicados na vitrine após o cron de 30 minutos; alguns aparecem com status paused no Mercado Livre devido à política de autorização da API.
- A última sincronização retornou HTTP 403 / PA_UNAUTHORIZED_RESULT_FROM_POLICIES para atualizações de estoque; isso exige permissões funcionais de escrita e reconexão do aplicativo pelo vendedor.

## Implementação
- Administração > Integrações > Mercado Livre mostra painel compacto de divergências com SKU, anúncio, estoque ERP e estoque anunciado.
- Administrador preenche a quantidade FÍSICA efetivamente conferida; o campo começa vazio, sem copiar o número externo.
- O salvamento exige confirmação explícita e cria MarketplaceStockConfirmation (administrador, data, saldo antigo, saldo novo, quantidade anunciada observada).
- Usa transação e condição de estoque anterior para evitar sobrescrever vendas ou atualizações concorrentes.
- Confirmado > 0: Produto.estoque e estoqueHub atualizados, ativo=true na loja Matilha Prado. Confirmado 0: permanece oculto.
- O cron continua sincronizando a cada 30 minutos; anúncio Mercado Livre só passa a active quando a API aceitar o status.
- Botão Publicar da vitrine fica desabilitado quando o estoque físico ERP = 0. A lista avisa quando o anúncio tem quantidade positiva na API e estoque local zero.
- Permissões externas não são contornadas: app ML precisa habilitar escopos de leitura/escrita e a conta vendedora principal precisa reconectar.

## Homologação
1. Migrar tabela MarketplaceStockConfirmation em cópia Neon QA.
2. Testar compilação, autenticação e navegador com duas contas; endpoints são ADMIN-only.
3. Confirmar um SKU em QA, conferir que saldo, ativo e log foram escritos juntos.
4. Testar concorrência: saldo anterior diferente deve retornar HTTP 409 e não atualizar estoque.
5. Publicar após CI. **Não alterar automaticamente os 40 saldos de produção**: são estoques físicos não verificados.
6. Depois da reconexão do ML, reexecutar a sincronização e confirmar alterações na conta vendedora.
