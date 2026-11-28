# Vitrine pública Matilha Prado

A página inicial atende visitantes. O endereço `/loja` também abre a vitrine para clientes conectados. Os acessos da equipe e do cliente continuam nos respectivos portais.

## Componentes e fontes

| Parte da página | Implementação | Origem |
| --- | --- | --- |
| Animação e banner de banho | StoreHero, StoreMotion e as imagens WebP em public/images/vitrine | Arte do Husky com bandana e objetos separados. Movimento condicionado à visibilidade, preferência do visitante e capacidade do dispositivo. |
| Categorias, marcas e pesquisa | ShopNavigation, PublicProducts e storefront-catalog | Uma leitura de /api/public/produtos por carregamento ou nova tentativa. Os filtros usam o catálogo em memória. O estoque segue a regra do hub e o agrupamento das variações. |
| Coleções | API pública de produtos | Mais vendidos agrega quantidades de vendas concluídas dos últimos 30 dias, pela mesma política do dashboard. Novidades considera o primeiro cadastro da família nesses 30 dias. Ofertas mostra preços promocionais vigentes. Os cadastros atuais não indicam uma data de encerramento por produto. |
| Detalhes e favoritos | ProductDetailsDialog e API de preferências | Variações reais, produtos da mesma categoria ou marca, links /loja?produto=ID e favoritos na conta. O carrinho guarda apenas IDs e quantidades na sessão do navegador e reconfere catálogo e estoque. |
| Spa e planos | StoreCare e /api/public/vitrine | Lista de serviços estéticos existente. Preços e faixas vêm dos mesmos grupos de porte e raça confirmados no catálogo da agenda. O portal calcula o preço do pet e os horários efetivamente disponíveis. Planos usam registros ativos do portal. A comparação mostra sessões, validade, total e preço por sessão. |
| Agendamento e contratação | ClientPortal, BookingRequests e ClientCareHub | Os atalhos retomam o destino após entrar. A contratação passa pela seleção do pet e aprovação já existentes. O cliente consulta horários pelo atendimento ou escolhe no portal uma vaga disponível para o pet. |
| Conteúdo e confiança | ClientBlog, GoogleReviews e StoreFooter | Artigos editoriais publicados na estrutura do blog. Diários e fotos de clientes permanecem sob o alcance do consentimento do portal. As avaliações vêm da integração do Google, com link direto quando a API estiver indisponível. |
| Contato, atendimento e instalação | /atendimento, /privacidade e InstallAppCard | Contatos e horários da loja, formas de entrega do checkout e instruções de instalação para o dispositivo. |

## Configuração opcional

| Configuração | Efeito |
| --- | --- |
| NEXT_PUBLIC_MATILHA_CAMPANHA | Seleciona natal, pascoa ou halloween. O link /loja?campanha= seguido do nome abre a coleção da campanha ativa. Ofertas e novidades também possuem links permanentes. |
| MATILHA_CUPONS_PUBLICOS | Lista de códigos separados por vírgula, selecionados expressamente para divulgação pública. A vitrine confere atividade, datas e limite global. O checkout valida as condições de cada cliente. |
| MATILHA_PLANOS_EQUIVALENTES | Objeto JSON que associa o ID de um plano ao nome exato de um serviço avulso equivalente confirmado pela loja. Só há economia exibida se a diferença for positiva com um preço público conhecido. |
| NEXT_PUBLIC_MATILHA_FOTO_LOJA | URL HTTPS de uma fotografia do estabelecimento aprovada para publicação aberta. |
| NEXT_PUBLIC_MATILHA_GA4_ID, NEXT_PUBLIC_MATILHA_ADS_PURCHASE, NEXT_PUBLIC_MATILHA_META_ID | Destinos opcionais para adaptadores gtag e fbq de um gerenciador de tags autorizado. Os IDs públicos não são credenciais privadas. |

A medição começa desativada. O rodapé permite escolher ou revogar medição de uso e de anúncios separadamente. O evento de visualização nasce na abertura do produto, o de carrinho após a inclusão e o de compra na aprovação. Solicitação e confirmação de agendamento são eventos diferentes. Conversões usam o ID da operação para deduplicação. Um integrador pode consumir o evento de navegador `matilha:store-event` ou usar os adaptadores de destino. Escolha uma via para cada destino. O carregamento e a configuração das tags externas devem respeitar a escolha por finalidade e desativar coleta automática de URLs e dados de formulário.

## Validação e publicação

O build de Preview pula migrações, bootstrap e crons de produção. A PR identifica o commit e a Vercel conserva a implantação anterior. A aprovação da página é necessária antes de integrar em main. Para reverter depois de uma publicação autorizada, use o último deploy de produção validado e reverta a alteração da vitrine no Git. Esta mudança não contém migrações de dados.

Os testes storefront-catalog e storefront-api.integration cobrem o índice de pesquisa e a projeção pública com PostgreSQL isolado. O teste de interface usa as mesmas APIs com respostas controladas apenas no navegador. Compare os WebP em tests/visual em 390 e 1280 px. A rotina também verifica 320 e 768 px, retorno do login, teclado, API lenta ou indisponível, ausência de estoque e imagens. A alteração das referências visuais é explícita com UPDATE_STOREFRONT_BASELINES=1 após inspeção. O workflow Vitrine pública inclui Chrome, Edge, Firefox, WebKit e uma verificação com SafariDriver no macOS.

## Segunda etapa

Dependem de material ou autorização da loja a seleção da fotografia pública, dos cupons, de equivalências de preço e dos destinos de campanhas. A publicação aberta de relatos e fotos de primeiro banho exigiria um aceite específico para visitantes anônimos, com possibilidade de revisão e revogação. As alterações no painel e nas regras comerciais ou de pagamento ficam fora desta primeira entrega.
