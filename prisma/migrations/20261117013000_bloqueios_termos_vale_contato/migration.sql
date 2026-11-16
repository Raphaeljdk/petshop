-- Aditiva; não altera vendas, estoque ou agendamentos existentes.
CREATE TABLE "AgendaBloqueio" (
  "id" TEXT NOT NULL,
  "profissionalId" TEXT NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL,
  "fim" TIMESTAMP(3) NOT NULL,
  "tipo" TEXT NOT NULL,
  "observacoes" TEXT,
  "criadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaBloqueio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgendaBloqueio_profissionalId_inicio_fim_idx" ON "AgendaBloqueio"("profissionalId","inicio","fim");
ALTER TABLE "AgendaBloqueio" ADD CONSTRAINT "AgendaBloqueio_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "ProfissionalAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD COLUMN "profissionalId" TEXT;
ALTER TABLE "PortalClientPreferences" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "PortalGiftRequest" ADD COLUMN "recipientWhatsapp" TEXT;
