ALTER TABLE "Processo" ADD COLUMN "requiresFicha" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE "AtendimentoFicha" (
  "id" TEXT NOT NULL,
  "processoId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "checkin" JSONB,
  "checkinStatus" TEXT NOT NULL DEFAULT 'rascunho',
  "checkinById" TEXT,
  "checkinSubmittedAt" TIMESTAMP(3),
  "tutorAceiteAt" TIMESTAMP(3),
  "tutorAceiteUserId" TEXT,
  "tutorAceiteNome" TEXT,
  "tutorAceiteVersao" TEXT,
  "tutorAceiteHash" TEXT,
  "tutorAceiteIpHash" TEXT,
  "checkout" JSONB,
  "checkoutById" TEXT,
  "checkoutFinalizadoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AtendimentoFicha_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AtendimentoFicha_processoId_key" ON "AtendimentoFicha"("processoId");
CREATE INDEX "AtendimentoFicha_clienteId_petId_createdAt_idx" ON "AtendimentoFicha"("clienteId","petId","createdAt");
CREATE INDEX "AtendimentoFicha_checkinStatus_checkinSubmittedAt_idx" ON "AtendimentoFicha"("checkinStatus","checkinSubmittedAt");
ALTER TABLE "AtendimentoFicha" ADD CONSTRAINT "AtendimentoFicha_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AtendimentoFichaEvento" (
  "id" TEXT NOT NULL,
  "fichaId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "resumo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AtendimentoFichaEvento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtendimentoFichaEvento_fichaId_createdAt_idx" ON "AtendimentoFichaEvento"("fichaId","createdAt");
ALTER TABLE "AtendimentoFichaEvento" ADD CONSTRAINT "AtendimentoFichaEvento_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "AtendimentoFicha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
