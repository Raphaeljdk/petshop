ALTER TABLE "Produto"
  ADD COLUMN "estoqueHub" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estoqueZetta" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estoqueMercadoLivre" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estoqueAmazon" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estoqueIlimitado" BOOLEAN NOT NULL DEFAULT false;

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
WHERE lower(unaccent(coalesce("nome", ''))) ~ '(^| )banho( |$)'
  AND (
    lower(unaccent(coalesce("nome", ''))) IN ('banho', 'banho e tosa')
    OR lower(unaccent(coalesce("nome", ''))) LIKE 'banho e tosa%'
    OR lower(unaccent(coalesce("categoria", ''))) LIKE '%servic%'
  );
