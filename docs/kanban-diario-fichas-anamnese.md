# Kanban diário e fichas de anamnese — Matilha Prado

## Kanban de pets
- Na abertura, o Kanban filtra somente os atendimentos cuja **data de criação (createdAt)** corresponde ao dia de hoje no fuso local do navegador.
- O campo **Dia dos atendimentos** permite escolher qualquer dia do histórico; há controles de dia anterior, Hoje e próximo dia.
- A busca por pet, tutor e serviço e o filtro por status atuam **dentro do dia selecionado**.
- Somente as colunas Novo, Em Andamento e Finalizado são exibidas. O status **Cancelado** deixa de ocupar espaço no Kanban; o botão de cancelamento continua disponível e o registro não é apagado.
- Um novo atendimento é aberto na data atual. Caso o usuário consulte outra data e crie um atendimento, a tela volta para hoje para que o novo card apareça.
- O contador da sidebar reflete os novos atendimentos criados **hoje** e é atualizado conforme seus status mudam.
- Observação: o critério de data é a **abertura do atendimento**, não a data agendada. O histórico completo permanece no banco.

## Ficha de Anamnese
- No painel administrativo, a sidebar tem **Dia a dia > Ficha de Anamnese**, que permite consultar por pet, tutor, serviço e data de abertura.
- A relação inclui atendimentos que exigem ficha de check-in/check-out, fichas já registradas e anamneses textuais legadas.
- As fichas estruturadas abrem o mesmo formulário do Kanban, sem duplicar informações: preenchimento, envio ao tutor, aceite, check-out e impressão A4.
- Registros antigos apenas com observações textuais são mostrados como consulta em modo leitura.
- Os atendimentos cancelados permanecem pesquisáveis nessa área quando possuem registro de ficha/anamnese.
- A API de listagem informa apenas os estados relevantes da ficha. A ficha completa continua carregada por ID somente via rota autenticada /api/processos/[id]/ficha, com as regras de permissão existentes.
- A aba é administrativa; contas com acesso exclusivo KANBAN mantêm seu painel operacional atual.

## Validação
- `bun test tests/kanban-dates.test.ts`
- `bun run typecheck`
- `bun run lint`
- Conferir hoje, ontem, datas futuras, criação durante consulta de data antiga, arrastar e cancelar atendimento, busca e filtros, leitura de histórico, autorização de tutor, check-out e impressão.
- Publicar apenas após CI/homologação.
