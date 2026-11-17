# Matilha Prado — check-in, anamnese, aceite e check-out

## Operação
- Kanban > cartão do atendimento > Check-in / Check-out / Imprimir.
- 1. Identificação automática do tutor e pet; 2–9. avaliação de saúde, pele, pelagem, ouvidos, olhos, unhas/patas, chegada e comunicação; 10. termo do tutor; 11. registro interno da equipe.
- A equipe preenche o check-in como rascunho e depois seleciona Enviar para aceite. O envio bloqueia qualquer edição do documento original. Campos não respondidos são impressos como não registrados; não são considerados normais.
- No portal do cliente > Meus Pets > Fichas de atendimento, o tutor lê integralmente a avaliação, concorda explicitamente com o termo e digita o nome, ou recusa a autorização.
- São gravados usuário autenticado, data/hora da decisão, versão do texto, hash SHA-256 do documento assinado e log de auditoria; não é uma assinatura manuscrita ou qualificada ICP-Brasil.
- Após o aceite, a equipe inicia o processo e preenche o check-out, com nove seções de serviço, secagem, pele, ouvidos, olhos, patas, conferência final, comunicação e responsáveis.
- Ao finalizar o check-out, a equipe bloqueia a ficha e o sistema inicia um pedido de **ciência e aceite da saída** no portal Meus Pets, independente do consentimento dado no check-in. O cliente não recebe acesso aos rascunhos.
- O tutor autenticado lê os registros completos da saída e o termo específico, marca a confirmação e digita o nome completo para registrar ciência, ou seleciona **Registrar discordância**. A discordância fica registrada; não apaga nem altera a ficha e não equivale à autorização retroativa de serviço.
- O sistema registra versão do termo de check-out, usuário, nome, data/hora, hash da ficha de saída e evento de auditoria. As fichas antigas finalizadas **não geram aceite retroativamente**: permanecem com status `nao_solicitado`.
- O resultado de saída aparece no histórico do tutor, no Kanban da equipe e na impressão A4.

## Regras
- Apenas novos processos estéticos (banho, tosa, SPA, hidratação e semelhantes) criados pela API recebem requiresFicha=true. Processos antigos não são bloqueados.
- Não é permitido iniciar sem aceite, nem mover para Finalizado sem check-out.
- Tutor pode recusar a autorização do **check-in**; isso fica registrado e impede o início. Equipe poderá cancelar o atendimento e avaliar novo procedimento conforme a situação.
- No **check-out**, a opção de discordância documenta a resposta do tutor e não muda automaticamente o status operacional ou financeiro do atendimento. O check-out permanece finalizado e imutável mesmo aguardando ciência.
- Equipe ADMIN/KANBAN só vê as fichas sob autenticação. Tutor CLIENTE só acessa fichas que correspondem ao seu clienteId; outra conta não consegue registrar aceite.
- Dados tratados como confidenciais. Não armazenar tokens, chaves, fotos ou informações de saúde em logs.
- Imprimir fichas no Kanban produz A4 no navegador, com campos integrais, aceite/nome/data/versão/hash quando disponíveis. O navegador permite escolher impressora ou "Salvar como PDF".

## Limites desta versão
- A indicação de "fotografias registradas" é um campo de declaração; o upload e armazenamento de fotos privadas de entrada/saída não foram implementados nesta fase.
- Não há envio automático de notificações externas com a ficha; o tutor a acessa autenticado no portal.
- Não há assinatura manuscrita/desenho de assinatura; a aceitação é registro eletrônico autenticado por nome e checkbox.
- A ficha é apenas uma avaliação visual preventiva e não equivale a diagnóstico veterinário.

## QA
- Migration Prisma 20261117010000_atendimento_checkin_checkout (tabela de fichas/eventos e indicador requiresFicha) aplicada na branch de homologação Neon.
- Testar autorização OWNER-only, recusa, formulário enviado imutável, saída imutável, histórico, impressão A4 e migração sem alteração dos atendimentos antigos.
- Testar check-out finalizado → `pendente_aceite` → `aceito` ou `recusado`; bloquear conta de outro cliente, dupla confirmação, assinatura sem checkbox/nome, formulário de saída não finalizado e versão desatualizada. Garantir que o aceite inicial segue inalterado.
- Aplicar a migration aditiva `20261117024000_checkout_aceite_tutor` antes de liberar o novo recurso em produção.
- Validar release build, TypeScript e testes de autenticação antes do merge. Publicar apenas se tudo passar e Vercel READY.
