# Matilha Prado — publicação automática por estoque (16/11/2026)

## Diagnóstico
A rotina de sincronização antes desta revisão atualizava a QUANTIDADE apenas para produtos com ativo=true e não mudava o status do anúncio pausado no Mercado Livre. O estado ativo/oculto da vitrine é diferente do status active/paused do marketplace.

Na revisão somente de leitura do banco de produção havia 460 produtos com vínculo ML, dos quais 160 tinham estoque operacional positivo e estavam ocultos na vitrine e 54 tinham saldo zero e estavam publicados. Estes números são um retrato, não uma garantia de disponibilidade externa.

O erro exibido nos 12 anúncios é UNAUTHORIZED no PUT de quantidade, não falta de estoque. A leitura do catálogo pode funcionar mesmo sem permissão de escrita na aplicação.

## Regra de publicação
1. Para produtos físicos vinculados a ML ou Amazon, Produto.estoque>0 => ativo=true na vitrine Matilha Prado.
2. Saldo zero => ativo=false na vitrine, sem reativar o anúncio remoto.
3. O cron autenticado de 30 minutos executa isso continuamente; o botão Sincronizar agora revalida.
4. Produtos com vários SKUs associados ao mesmo item_id ML são bloqueados até existir mapeamento variation_id confiável.
5. Para anúncio ML status paused com estoque local positivo, consultar status/sub_status/tags e seller_id. Se for pausa simples, atualizar quantidade se necessário e enviar PUT status active; registrar confirmação e resultados.
6. NUNCA reativar closed, under_review, inactive, moderação, anúncio de outro seller ou anúncio sem status confiável.
7. Permissões negadas/UNAUTHORIZED entram na lista de pendências com recuo; o cron não consegue substituir o consentimento exigido pela API.
8. Para novos produtos importados do ML, status paused não zera quantidade anunciada; valores do marketplace não sobrescrevem estoque físico de produtos existentes.

## Ajustes que o cliente precisa fazer no Mercado Livre
No painel de Desenvolvedores Mercado Livre, localizar a aplicação associada à Matilha Prado e verificar as permissões funcionais de Publicações com leitura e ESCRITA. Depois de salvar, a conta vendedora principal deve usar Reconectar Mercado Livre em Administração > Integrações. Confirmar também que a aplicação não está suspensa e não há moderação específica. Nunca compartilhar tokens ou senhas no chat.

Exemplo do retorno que impede escrita:
- código: PA_UNAUTHORIZED_RESULT_FROM_POLICIES
- resposta: At least one policy returned UNAUTHORIZED.
- provedor pode retornar HTTP 403.
Não repetir a mesma ação indiscriminadamente: ela não pode revogar as regras do Mercado Livre.

## Antes de considerar concluído
- CI release-build, typecheck, autenticação e testes de variantes.
- Migração de indicadores lastMlActivated/lastLocalPublished/lastLocalHidden/lastBlockedListings em banco QA isolado e depois produção.
- No painel: conferir publicados localmente, reativados no ML, bloqueios e erros por ID.
- Na conta Mercado Livre, verificar status active dos anúncios após conceder escrita e reconectar.
- Na Amazon, saldo enviado pela API não garante compra habilitada sem conferir ficha e permissões.

Nunca apresentar a visibilidade da vitrine como se fosse aprovação automática da publicação no Mercado Livre.
