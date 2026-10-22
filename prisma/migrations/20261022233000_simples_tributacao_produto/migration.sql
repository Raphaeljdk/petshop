-- Campos de classificação opcionais para revisão contábil no Simples Nacional (CRT 1).
-- Migração aditiva: não modifica produtos, estoque, notas ou valores já cadastrados.
ALTER TABLE "Produto"
  ADD COLUMN "gtinFiscal" TEXT,
  ADD COLUMN "pisCst" TEXT,
  ADD COLUMN "cofinsCst" TEXT,
  ADD COLUMN "ipiCst" TEXT,
  ADD COLUMN "ibsCbsCst" TEXT,
  ADD COLUMN "ibsCbsClassTrib" TEXT;
