-- Isolated production numbering. No seed, no activation, no changes to existing invoices.
CREATE TABLE "NfeRealSequencia" (
  "cnpj" TEXT NOT NULL CHECK ("cnpj" ~ '^[0-9]{14}$'),
  "modelo" TEXT NOT NULL DEFAULT '55' CHECK ("modelo" = '55'),
  "serie" INTEGER NOT NULL CHECK ("serie" = 2),
  "ambiente" INTEGER NOT NULL DEFAULT 1 CHECK ("ambiente" = 1),
  "primeiroNumero" INTEGER NOT NULL CHECK ("primeiroNumero" BETWEEN 1 AND 999999999),
  "proximoNumero" INTEGER NOT NULL CHECK ("proximoNumero" BETWEEN 1 AND 1000000000),
  "referenciaNumeracao" TEXT NOT NULL CHECK (length(trim("referenciaNumeracao")) >= 5),
  "referenciaContabil" TEXT NOT NULL CHECK (length(trim("referenciaContabil")) >= 5),
  "referenciaSchema" TEXT NOT NULL CHECK (length(trim("referenciaSchema")) >= 5),
  "exclusivo" BOOLEAN NOT NULL DEFAULT false,
  "habilitado" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("cnpj","modelo","serie","ambiente"),
  CHECK ("proximoNumero" >= "primeiroNumero"),
  CHECK (NOT "habilitado" OR "exclusivo")
);
CREATE TABLE "NfeRealReserva" (
  "id" TEXT PRIMARY KEY,
  "vendaId" TEXT NOT NULL UNIQUE REFERENCES "Venda"("id") ON DELETE RESTRICT,
  "cnpj" TEXT NOT NULL,
  "modelo" TEXT NOT NULL DEFAULT '55',
  "serie" INTEGER NOT NULL,
  "numero" INTEGER NOT NULL CHECK ("numero" BETWEEN 1 AND 999999999),
  "ambiente" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'reservada' CHECK ("status" IN ('reservada','preparada','enviando','incerta','recebida','rejeitada','autorizada','cancelada','inutilizada')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("cnpj","modelo","serie","ambiente") REFERENCES "NfeRealSequencia"("cnpj","modelo","serie","ambiente") ON DELETE RESTRICT,
  UNIQUE ("cnpj","modelo","serie","numero","ambiente")
);
