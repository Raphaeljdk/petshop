ALTER TABLE "Venda"
  ADD COLUMN "siggmaGuid" TEXT,
  ADD COLUMN "siggmaImportStatus" TEXT,
  ADD COLUMN "siggmaImportedAt" TIMESTAMP(3),
  ADD COLUMN "siggmaImportError" TEXT;

CREATE UNIQUE INDEX "Venda_siggmaGuid_key" ON "Venda"("siggmaGuid");
