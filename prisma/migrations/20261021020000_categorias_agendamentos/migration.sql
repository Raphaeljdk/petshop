-- Categorias internas de agendamento próprias do Hub, sem integração externa.
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "categoria" TEXT NOT NULL DEFAULT 'Gerais';
-- Preserva atendimentos existentes, classificando quando o nome do serviço for reconhecível.
UPDATE "Agendamento" SET "categoria" = CASE
  WHEN "servico" ~* '(cirurg|castra)' THEN 'Cirurgias'
  WHEN "servico" ~* '(vacin|imuniza)' THEN 'Vacinas'
  WHEN "servico" ~* '(vermif|desparasit)' THEN 'Vermífugos'
  WHEN "servico" ~* '(internac|internad)' THEN 'Internações'
  WHEN "servico" ~* '(hosped|hotel|pernoite)' THEN 'Hospedagens'
  WHEN "servico" ~* '(day.?care|creche|recrea)' THEN 'Day Care'
  WHEN "servico" ~* '(banho|tosa|est.tic|hidratac)' THEN 'Estéticos'
  WHEN "servico" ~* '(externo|domicili)' THEN 'Externos'
  WHEN "servico" ~* '(clinico|clínico|consulta|exame|avalia)' THEN 'Clínicos'
  ELSE 'Gerais' END
WHERE "categoria" = 'Gerais';
CREATE INDEX IF NOT EXISTS "Agendamento_categoria_dataHora_idx" ON "Agendamento"("categoria","dataHora");
