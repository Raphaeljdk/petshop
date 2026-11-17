# Diário do Pet — aceite individual e publicação moderada no blog

## Solicitação
Permitir que o tutor registre um relato no **Diário do Pet** ("Primeiro banho", por exemplo) e aceite **opcionalmente** exibir título, anotações e a foto anexada no blog do portal da Matilha Prado.

## Regras de privacidade
- **Padrão privado:** o checkbox começa desmarcado. Nenhum registro histórico ganha permissão automaticamente.
- Somente registros de tipo `diario` criados pelo tutor podem ser enviados. **Comprovantes de vacinação, peso, documentos PDF e fotos internas da equipe** não entram na publicação.
- Aceite individual para cada registro, com informação clara de que **título, texto e foto** serão visíveis aos clientes que acessarem o blog, após revisão.
- O envio cria situação `pendente` e registra `blogConsentAt`. Não publica automaticamente.
- Administrador com função ADMIN vê somente registros consentidos pendentes/publicados, revisa conteúdo e aprova ou recusa.
- A consulta do blog retorna apenas `kind='diario'`, `createdByAdmin=false`, `blogConsentAt IS NOT NULL` e `blogStatus='publicado'`. Projeção pública contém apenas título, texto, foto, categoria e data; **não inclui e-mail, nome do tutor, telefone, peso, documentos ou IDs internos**.
- Em qualquer momento o tutor pode **retirar a autorização** pela própria ficha. A consulta pública deixa imediatamente de listar a história; uma eventual consulta já aberta precisa ser recarregada.
- O tutor pode apagar definitivamente seu registro: a história desaparece junto, pois é renderizada diretamente da ficha original, sem cópias públicas.
- A equipe pode recusar ou retirar uma história publicada. Para voltar a publicar, exige um novo aceite do tutor seguido de revisão.
- Conteúdo sensível e pessoas visíveis nas fotos devem ser avaliados pelo administrador antes da aprovação. O consentimento do diário é **independente** da autorização privada de fotos de antes/depois dos banhos.
- Publicações estão no **Blog do portal do cliente**, sem publicação em redes sociais ou no site público por esta funcionalidade.

## Operação
1. Tutor: `Vida do pet e benefícios → Diário do Pet`, preencher relato e foto opcional; marcar o aceite; adicionar ao diário.
2. Admin: `Portal editorial → Blog — criar e revisar artigos → Histórias dos pets`, aprovar ou recusar.
3. Tutor: no cartão do diário, acompanhar estado e retirar a autorização quando desejar.
4. Blog: ler as histórias aprovadas na categoria **Histórias dos pets**.

## Dados e testes
- Migração aditiva de `PortalPetMemory`: `blogConsentAt`, `blogStatus`, `blogReviewedAt` e `blogReviewedBy`.
- Registros anteriores continuam `blogStatus='privado'` e `blogConsentAt=null`.
- `bun test tests/portal-pet-blog.test.ts` verifica privacidade padrão, restrição de tipo e projeção de campos.
- Validar build e fluxos com contas de tutor e admin, envio sem aceite, aprovação, publicação, revogação e exclusão.
