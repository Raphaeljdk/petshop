-- Vincula a conta do portal ao cliente oficial do Siggma/Zetta.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "siggmaCliCod" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "User_siggmaCliCod_key"
ON "User"("siggmaCliCod");
