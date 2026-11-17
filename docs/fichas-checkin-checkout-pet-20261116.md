# Matilha Prado — check-in, anamnese, aceite e check-out

## Operação
- Kanban > cartão do atendimento > Check-in / Check-out / Imprimir.
- 1. Identificação automática do tutor e pet; 2–9. avaliação de saúde, pele, pelagem, ouvidos, olhos, unhas/patas, chegada e comunicação; 10. termo do tutor; 11. registro interno da equipe.
- A equipe preenche o check-in como rascunho e depois seleciona Enviar para aceite. O envio bloqueia qualquer edição do documento original. Campos não respondidos são impressos como não registrados; não são considerados normais.
- No portal do cliente > Meus Pets > Fichas de atendimento, o tutor lê integralmente a avaliação, concorda explicitamente com o termo e digita o nome, ou recusa a autorização.
- São gravados usuário autenticado, data/hora da decisão, versão do texto, hash SHA-256 do documento assinado e log de auditoria; não é uma assinatura manuscrita ou qualificada ICP-Brasil.
- Após o aceite, a equipe inicia o processo e preenche o check-out, com nove seções de serviço, secagem, pele, ouvidos, olhos, patas, conferência final, comunicação e responsáveis.
- Check-out finalizado fica imutável e passa a ser visível no histórico privado do pet. O cliente não recebe acesso aos rascunhos de check-out.
- A finalização da equipe marca `checkoutAceiteStatus=pendente` e exibe **Ler saída e responder** em **Meus Pets**. O tutor autenticado confere a ficha e registra ciência ou discordância, com nome completo. A confirmação de ciência exige checkbox explícito; a discordância não exige concordar com o conteúdo.
- A resposta de saída fica armazenada separadamente do aceite do check-in (usuário, data/hora, versão do termo, hash SHA-256 do conteúdo e auditoria, com IP apenas em hash quando disponível). Uma resposta já registrada não pode ser alterada. A impressão A4 apresenta as duas respostas.
- O registro da ciência do check-out **não substitui a autorização do check-in**, não significa renúncia de direitos e não bloqueia o encerramento operacional do serviço pela equipe.
- Check-outs anteriores a esta implantação permanecem com `nao_solicitado` para não gerar autorizações retroativas nem alterar registros antigos.

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
- Testar ciência e discordância do check-out, bloqueio de duplicidade, rejeição a outro tutor, registros antigos sem pedido retroativo, envio só após finalização, e impressão de status/assinatura/hash.
- Validar release build, TypeScript e testes de autenticação antes do merge. Publicar apenas se tudo passar e Vercel READY.
