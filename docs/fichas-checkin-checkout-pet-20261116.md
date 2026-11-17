# Matilha Prado — check-in, anamnese, aceite e check-out

## Operação
- Kanban > cartão do atendimento > Check-in / Check-out / Imprimir.
- 1. Identificação automática do tutor e pet; 2–9. avaliação de saúde, pele, pelagem, ouvidos, olhos, unhas/patas, chegada e comunicação; 10. registro interno da equipe; 11. termo do tutor.
- A equipe preenche o check-in como rascunho e depois seleciona Enviar para aceite. O envio bloqueia qualquer edição do documento original. Campos não respondidos são impressos como não registrados; não são considerados normais.
- No portal do cliente > Meus Pets > Fichas de atendimento, o tutor lê integralmente a avaliação, concorda explicitamente com o termo e digita o nome, ou recusa a autorização.
- São gravados usuário autenticado, data/hora da decisão, versão do texto, hash SHA-256 do documento assinado e log de auditoria; não é uma assinatura manuscrita ou qualificada ICP-Brasil.
- Após o aceite, a equipe inicia o processo e preenche o check-out, com nove seções de serviço, secagem, pele, ouvidos, olhos, patas, conferência final, comunicação e responsáveis.
- Check-out finalizado fica imutável e passa a ser visível no histórico privado do pet. O cliente não recebe acesso aos rascunhos de check-out.

## Regras
- Apenas novos processos estéticos (banho, tosa, SPA, hidratação e semelhantes) criados pela API recebem requiresFicha=true. Processos antigos não são bloqueados.
- Não é permitido iniciar sem aceite, nem mover para Finalizado sem check-out.
- Tutor pode recusar a autorização; isso fica registrado e impede o início. Equipe poderá cancelar o atendimento e avaliar novo procedimento conforme a situação.
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
- Validar release build, TypeScript e testes de autenticação antes do merge. Publicar apenas se tudo passar e Vercel READY.
