# Agendamento direto no portal + blog público na página inicial

Implantação: proposta iniciada em 20/11/2026. Nenhuma reserva é liberada automaticamente antes de o gestor definir o expediente.

## Agendamento pelo próprio site

- Portal do cliente → **Agendamentos** possui um único formulário: pet, serviço, profissional, dia, horário livre e observações.
- Botão **Novo agendamento** leva ao formulário; o calendário adicional de consulta por WhatsApp foi removido para evitar dupla jornada.
- A consulta `/api/cliente/agendamentos/horarios` só apresenta horários quando a equipe tiver **habilitado** agenda online e informado os dias, abertura, fechamento e intervalo no painel administrativo.
- O administrador configura isso em **Agenda Matilha Prado → Agendamento direto pelo site**. A configuração é **desativada por padrão**, sem horários fictícios.
- A disponibilidade considera profissionais ativos, bloqueios de agenda e atendimentos existentes; os serviços requerem `ServicoEsteticoConfig.confirmado=true` com duração.
- A reserva confirmada cria um `Agendamento` de status `agendado` e um `AgendaEvento`, visíveis à operação e ao cliente; a escrita usa transação serializável e bloqueio transacional por profissional/dia para reduzir disputa de horários. A disponibilidade é revalidada imediatamente antes da gravação.
- O portal mantém histórico e cancelamento de agendamentos de acordo com a regra existente (somente `agendado` com mais de 24 horas).
- Solicitações antigas ficam disponíveis para consulta/cancelamento, mas o novo fluxo não cria solicitações pendentes para a loja.
- Regras técnicas: São Paulo/Brasília (UTC-03:00 no calendário atual), antecipação mínima 15 min, horizonte 90 dias. Agendamentos sem duração configurada são tratados conservadoramente como indisponibilidade durante até 12 horas para evitar sobreposição.
- **Não existe pagamento automático** nem preço público associado a esta reserva; qualquer integração financeira exige homologação própria.
- Para liberar novas vagas, o gestor deve confirmar serviços/durações, cadastrar profissionais e salvar o expediente ativado.

## Blog na Home pública

- A seção `LandingBlog` aparece logo abaixo do carrossel principal quando existirem publicações reais.
- Publicações editoriais devem ter `published=true`; diários de pets exigem `kind=diario`, `blogStatus=publicado`, `blogConsentAt` preenchido e `createdByAdmin=false`.
- Os dados são projetados em endpoint público `/api/public/blog`: título, categoria, resumo, texto, data e imagem autorizada; **nenhum e-mail, tutor, peso, vacina ou documento privado**.
- Os três últimos artigos possuem cartões com imagem e abertura do texto completo em diálogo na mesma página. Mais artigos aprovados aparecem no mesmo bloco.
- O resumo do blog da **Home do cliente** também ganhou imagens.
- Se nada estiver publicado e aprovado, a Home pública não inventa posts nem exibe uma seção vazia.

## Homologação
1. Rodar `bun test tests/agenda-online.test.ts tests/portal-pet-blog.test.ts`, `bun run typecheck` e build.
2. Em ambiente isolado, configurar horários reais e confirmar um serviço com duração.
3. Agendar com dois clientes no mesmo horário/profissional (o segundo deve ser bloqueado); confirmar bloqueio por almoço, histórico e cancelamento.
4. Criar um artigo editorial publicado com imagem; aprovar/revogar consentimento de uma história com foto e conferir sua aparição/remoção na landing.
5. Validar desktop e mobile, confirmar que o blog público não expõe diários em análise nem documentos clínicos.
