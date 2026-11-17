-- Migração aditiva. Fichas de saída antigas permanecem sem solicitação automática.
ALTER TABLE "AtendimentoFicha"
  ADD COLUMN "checkoutStatus" TEXT NOT NULL DEFAULT 'nao_solicitado',
  ADD COLUMN "checkoutAceiteAt" TIMESTAMP(3),
  ADD COLUMN "checkoutAceiteUserId" TEXT,
  ADD COLUMN "checkoutAceiteNome" TEXT,
  ADD COLUMN "checkoutAceiteVersao" TEXT,
  ADD COLUMN "checkoutAceiteHash" TEXT,
  ADD COLUMN "checkoutAceiteIpHash" TEXT;

CREATE INDEX "AtendimentoFicha_checkoutStatus_checkoutFinalizadoAt_idx"
  ON "AtendimentoFicha"("checkoutStatus", "checkoutFinalizadoAt");
