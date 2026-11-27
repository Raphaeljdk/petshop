-- Não inferir base zero a partir da alíquota do produto ou do regime do emitente.
ALTER TABLE "NfeRealAprovacao" ADD COLUMN "baseZeroCst49" BOOLEAN NOT NULL DEFAULT false;
