# Matilha Prado — Portal do cliente, blog e cuidados (16/11/2026)

## Entrega no GitHub

- Branch: feat/portal-cliente-blog-cuidados-20261116
- PR #123: https://github.com/Raphaeljdk/petshop/pull/123
- Estado: **rascunho**. Não foi publicada na Vercel de produção.
- Migração: prisma/migrations/20261116160000_portal_cliente_blog_cuidados/migration.sql

O projeto já possuía Início, Loja, Agenda, Meus Pets, Vacinas, Minhas Compras, favoritos, programas de fidelidade e registros de atendimentos. Esta versão preserva essas telas.

## 11 melhorias — situação e limites

| Recurso | Implementação na PR | O que falta para ativação completa |
| --- | --- | --- |
| Blog Matilha Prado | Nova aba para usuários; busca, categorias, leitura, favoritos; editor para equipe em Relacionamento | Revisão e publicação de artigos reais, otimização SEO pública se desejada |
| Diário do pet | Histórico privado por pet com peso, observações e foto compactada | Validação operacional com tutores e eventual armazenamento de mídia dedicado |
| Carteirinha digital | Fotos de comprovantes particulares na área Vacinas e em Meus Pets; data de próxima dose registrada pelo tutor | Suporte a PDF privado e validação documental por profissional, sem sobrescrever o histórico oficial |
| Banho com fotos | Antes/depois pela equipe vinculados ao atendimento e ao consentimento do tutor | Treinamento da equipe; teste com fotos reais; não compartilha publicamente |
| Notificações | Preferências separadas por e-mail/WhatsApp/portal para ofertas e lembretes | Integração opt-in com provedores, rotinas de envio, descadastro, registros de entrega |
| Planos de banho | Criação de pacotes pela equipe, solicitação por pet, aprovação manual auditada, saldo e baixa idempotente vinculada a atendimento concluído | Cobrança automática, renovação, confirmação de pagamento no provedor e modelo comercial aprovado |
| Recomendações | Regras simples com espécie, porte, idade e categorias de produtos favoritas | Refinar catálogo e validar adequação antes de personalização avançada |
| Indique e Ganhe | Código individual, resgate por outra conta, verificação de primeira compra paga | Definir valores/benefícios e implementar emissão de cupom pessoal com controle de estornos |
| Vale-presente digital | Solicitação do tutor, conferência administrativa de pagamento e geração de código | Checkout de compra, emissão/entrega automática, resgate e saldo parcial no checkout |
| Compartilhar pet | Convite, aceite do destinatário, aprovação final do titular e revogação; apenas dados básicos e próxima agenda | Verificação por e-mail e suporte a agendamentos da fonte externa Siggma |
| Página inicial | Prévia do blog, cards já existentes dos pets, agendamentos e compras | Homologação visual com cliente e possível reorganização compacta da home |

### Privacidade e limites

- Todas as fotos e anotações privadas são filtradas pelo cliente autenticado e pela propriedade do pet; imagens do diário não têm URL pública.
- O upload aceita somente JPEG, PNG e WebP por dados URL validados, com limite de tamanho, no banco próprio do portal.
- Cada conta tem limite inicial de 100 registros particulares e 30 imagens, mais no máximo 5 solicitações de presente pendentes e 5 convites familiares ativos por pet.
- Dados do ERP legado/Siggma não são modificados por esses módulos.
- Fotos enviadas pela equipe exigem autorização ativa do tutor. **A retirada dessa autorização apaga do banco próprio as fotos do tipo antes/depois enviadas pela equipe.**
- Familiar convidado vê somente nome, espécie e próximos atendimentos de pets locais **após aceitação e aprovação do proprietário**; fotos, vacinas, diário e outros dados privados permanecem ocultos.
- Artigos são texto simples no React; o conteúdo não é interpretado como HTML injetado.
- Convites não enviam automaticamente e-mails; a pessoa precisa acessar sua própria conta e localizar o convite.
- Nenhum WhatsApp ou e-mail automático é enviado apenas por salvar preferências.
- Não prometer cobrança, crédito, desconto ou resgate automático de vales. Todos esses recursos dependem de regras comerciais e integração segura.

### Homologação obrigatória

1. Criar uma branch isolada no Neon com backup/snapshot e verificar a migração antes de aplicar. No fluxo atual de build em produção existem etapas de migração; **não publicar sem confirmar o alvo e revisar migrações pendentes**.
2. Conferir workflow CI, TypeScript, build, testes e acesso de cliente/admin.
3. ADMIN: criar rascunho de artigo; login de cliente não deve vê-lo. Publicar e conferir o artigo no Blog. Voltar a despublicar e verificar ocultação.
4. Cliente A: cadastrar diário e comprovante de pet. Cliente B não pode acessar dados do cliente A, inclusive por ID adivinhado.
5. Ativar autorização de foto; administrador adiciona foto a processo do mesmo cliente. Revogar autorização e confirmar exclusão das fotos de banho.
6. Cadastrar plano, solicitar, aprovar após pagamento conferido e registrar atendimento concluído real. Confirmar que só uma baixa de sessão é permitida por processo.
7. Indicação: código inválido ou próprio devem ser rejeitados; verificar compra elegível sem atribuir desconto automático.
8. Vale-presente: solicitar e aprovar somente com referência de pagamento verificado; informar que código ainda não é aceito no checkout.
9. Compartilhamento: aceitar no login convidado; antes da autorização final do proprietário nada é revelado; após autorização, só mostrar resumo e agenda. Revogar e confirmar encerramento.
10. Revisar interface no celular e desktop, navegação por teclado, estados de erro e consentimento. **Somente após aceite liberar produção.**

## Custos/integrações ainda sem definição do cliente

- Quais pacotes, preço, número de sessões e validade de cada plano?
- Qual bônus por indicação e quais condições para resgate?
- Que valores e quais serviços ou produtos os vales poderão cobrir?
- Que canal de envio automático está autorizado e com qual provedor, considerando opt-in e LGPD?
- Que formatos de documentos além de imagens serão necessários e onde guardar arquivos privados?

Esta PR é a **primeira versão operacional em homologação**, não uma implantação financeira completa.
