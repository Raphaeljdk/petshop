-- Vincula os produtos locais ao cadastro oficial do ERP Zetta.
ALTER TABLE "Produto"
ADD COLUMN IF NOT EXISTS "zettaProCod" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Produto_zettaProCod_key"
ON "Produto"("zettaProCod");
