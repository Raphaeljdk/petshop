-- Entrega transacional ao cliente: somente NF-e real autorizada, 1 envio por nota.
-- Não modifica NotaFiscal, Venda, NfeHomologacao nem estado de produção.
CREATE TABLE "NfeEmailDelivery" (
  "id" TEXT NOT NULL,
  "notaFiscalId" TEXT NOT NULL,
  "destinatarioEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "providerId" TEXT,
  "sentAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NfeEmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NfeEmailDelivery_notaFiscalId_key" ON "NfeEmailDelivery"("notaFiscalId");
CREATE INDEX "NfeEmailDelivery_status_createdAt_idx" ON "NfeEmailDelivery"("status", "createdAt");
ALTER TABLE "NfeEmailDelivery" ADD CONSTRAINT "NfeEmailDelivery_notaFiscalId_fkey"
  FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
