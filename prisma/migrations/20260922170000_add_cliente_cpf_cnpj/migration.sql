ALTER TABLE "Cliente" ADD COLUMN "cpfCnpj" TEXT;

CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");
