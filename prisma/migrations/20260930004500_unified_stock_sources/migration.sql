ALTER TABLE "Produto"
  ADD COLUMN IF NOT EXISTS "estoqueHub" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estoqueZetta" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estoqueMercadoLivre" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estoqueAmazon" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estoqueIlimitado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Produto"
SET
  "estoqueHub" = CASE
    WHEN "zettaProCod" IS NULL AND "mlItemId" IS NULL AND "amazonAsin" IS NULL
      THEN GREATEST("estoque", 0)
    ELSE 0
  END,
  "estoqueZetta" = CASE
    WHEN "zettaProCod" IS NOT NULL THEN GREATEST("estoque", 0)
    ELSE 0
  END,
  "estoqueMercadoLivre" = CASE
    WHEN "zettaProCod" IS NULL AND "mlItemId" IS NOT NULL THEN GREATEST("estoque", 0)
    ELSE 0
  END,
  "estoqueAmazon" = CASE
    WHEN "zettaProCod" IS NULL AND "mlItemId" IS NULL AND "amazonAsin" IS NOT NULL
      THEN GREATEST("estoque", 0)
    ELSE 0
  END;

UPDATE "Produto"
SET "estoqueIlimitado" = true
WHERE lower(coalesce("nome", '')) ~ '(^| )banho( |$)'
  AND (
    lower(coalesce("nome", '')) IN ('banho', 'banho e tosa')
    OR lower(coalesce("nome", '')) LIKE 'banho e tosa%'
    OR lower(coalesce("categoria", '')) LIKE '%servic%'
  );
