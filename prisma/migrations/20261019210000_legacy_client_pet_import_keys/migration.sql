-- Referências de importação idempotente, sem dependência operacional do Zetta.
ALTER TABLE "Cliente" ADD COLUMN "importacaoLegadoId" TEXT;
ALTER TABLE "Pet" ADD COLUMN "importacaoLegadoId" TEXT;
CREATE UNIQUE INDEX "Cliente_importacaoLegadoId_key" ON "Cliente"("importacaoLegadoId");
CREATE UNIQUE INDEX "Pet_importacaoLegadoId_key" ON "Pet"("importacaoLegadoId");
