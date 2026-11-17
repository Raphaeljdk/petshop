-- Novas respostas só são solicitadas para check-outs finalizados após a implantação.
-- Fichas anteriores permanecem historicamente finalizadas sem resposta retroativa.
ALTER TABLE "AtendimentoFicha"
  ADD COLUMN "checkoutAceiteStatus" TEXT NOT NULL DEFAULT 'nao_solicitado',
  ADD COLUMN "checkoutAceiteAt" TIMESTAMP(3),
  ADD COLUMN "checkoutAceiteUserId" TEXT,
  ADD COLUMN "checkoutAceiteNome" TEXT,
  ADD COLUMN "checkoutAceiteVersao" TEXT,
  ADD COLUMN "checkoutAceiteHash" TEXT,
  ADD COLUMN "checkoutAceiteIpHash" TEXT;
