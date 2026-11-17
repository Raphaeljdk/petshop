-- Parâmetro operacional da apuração fiscal. Não é uma alíquota nem autoriza NF-e real.
ALTER TABLE "ConfiguracaoFiscal"
  ADD COLUMN IF NOT EXISTS "apuracaoTributaria" TEXT NOT NULL DEFAULT 'PENDENTE_VALIDACAO';

-- Somente a empresa confirmada como CRT 1 utiliza PGDAS-D.
-- Demais regimes permanecem pendentes de tratamento específico.
UPDATE "ConfiguracaoFiscal"
SET "apuracaoTributaria"='PGDAS_D'
WHERE "id"='matilha-prado' AND "regimeTributario"='1'
  AND "apuracaoTributaria"='PENDENTE_VALIDACAO';
