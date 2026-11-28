BEGIN;
ALTER TABLE "Cliente" ADD COLUMN "numeroCliente" INTEGER;
CREATE SEQUENCE "Cliente_numeroCliente_seq" AS INTEGER;
ALTER SEQUENCE "Cliente_numeroCliente_seq" OWNED BY "Cliente"."numeroCliente";
WITH numerados AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id)::INTEGER AS numero
  FROM "Cliente"
)
UPDATE "Cliente" c SET "numeroCliente" = n.numero FROM numerados n WHERE c.id = n.id;
SELECT setval('"Cliente_numeroCliente_seq"', COALESCE(MAX("numeroCliente"), 1), COUNT(*) > 0) FROM "Cliente";
ALTER TABLE "Cliente" ALTER COLUMN "numeroCliente" SET DEFAULT nextval('"Cliente_numeroCliente_seq"');
ALTER TABLE "Cliente" ALTER COLUMN "numeroCliente" SET NOT NULL;
CREATE UNIQUE INDEX "Cliente_numeroCliente_key" ON "Cliente"("numeroCliente");
COMMIT;
