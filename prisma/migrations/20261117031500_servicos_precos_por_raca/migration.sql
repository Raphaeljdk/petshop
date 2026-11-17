-- Migração aditiva: preserva preço de referência e todas as configurações existentes.
-- Os preços por raça permanecem internos; não alteram vendas, agendamentos nem dados fiscais.
ALTER TABLE "ServicoEsteticoConfig"
  ADD COLUMN "precosPorRaca" JSONB NOT NULL DEFAULT '[]'::jsonb;
