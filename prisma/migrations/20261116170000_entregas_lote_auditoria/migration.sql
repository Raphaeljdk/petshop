CREATE TABLE "EntregaLoteAuditoria" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "pedidoIds" JSONB NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "acao" TEXT NOT NULL DEFAULT 'entregue',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntregaLoteAuditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EntregaLoteAuditoria_createdAt_idx" ON "EntregaLoteAuditoria"("createdAt");