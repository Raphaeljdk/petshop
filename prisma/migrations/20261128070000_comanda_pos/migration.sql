CREATE TABLE "ComandaPagamentoPOS" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "processoId" TEXT NOT NULL,
 "registradoPorId" TEXT NOT NULL,
 "adquirente" VARCHAR(80) NOT NULL,
 "terminal" VARCHAR(80) NOT NULL,
 "referencia" VARCHAR(100) NOT NULL,
 "metodo" VARCHAR(20) NOT NULL,
 "totalCentavos" INTEGER NOT NULL CHECK ("totalCentavos">0),
 "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ComandaPagamentoPOS_adquirente_terminal_referencia_key" ON "ComandaPagamentoPOS"("adquirente","terminal","referencia");
CREATE INDEX "ComandaPagamentoPOS_processoId_idx" ON "ComandaPagamentoPOS"("processoId");
ALTER TABLE "Venda" ADD COLUMN "posPagamentoId" TEXT, ADD COLUMN "posPagoCentavos" INTEGER, ADD COLUMN "pagamentoOnlineIniciadoEm" TIMESTAMP(3);
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_posPagamentoId_fkey" FOREIGN KEY ("posPagamentoId") REFERENCES "ComandaPagamentoPOS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
