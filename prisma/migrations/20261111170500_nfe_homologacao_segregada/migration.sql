CREATE TABLE "NfeHomologacao" (
    "id" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "ambiente" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'preparada',
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "xmlAssinado" TEXT NOT NULL,
    "xmlAutorizado" TEXT,
    "recibo" TEXT,
    "protocolo" TEXT,
    "codigoSefaz" INTEGER,
    "motivoSefaz" TEXT,
    "enviadaEm" TIMESTAMP(3),
    "autorizadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NfeHomologacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfeHomologacao_chave_key" ON "NfeHomologacao"("chave");
CREATE UNIQUE INDEX "NfeHomologacao_serie_numero_key" ON "NfeHomologacao"("serie", "numero");
CREATE INDEX "NfeHomologacao_status_createdAt_idx" ON "NfeHomologacao"("status", "createdAt");
