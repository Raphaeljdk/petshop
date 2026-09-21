-- CreateTable
CREATE TABLE IF NOT EXISTS "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipoDesconto" TEXT NOT NULL DEFAULT 'percentual',
    "valor" DOUBLE PRECISION NOT NULL,
    "valorMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteUsos" INTEGER,
    "limitePorCliente" INTEGER NOT NULL DEFAULT 1,
    "inicioEm" TIMESTAMP(3),
    "fimEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "influenciadorNome" TEXT,
    "influenciadorContato" TEXT,
    "comissaoPercentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Venda"
ADD COLUMN IF NOT EXISTS "subtotalProdutos" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cupomId" TEXT,
ADD COLUMN IF NOT EXISTS "cupomCodigo" TEXT,
ADD COLUMN IF NOT EXISTS "descontoCupom" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CupomUso" (
    "id" TEXT NOT NULL,
    "cupomId" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "codigo" TEXT NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL,
    "comissao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CupomUso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Cupom_codigo_key" ON "Cupom"("codigo");
CREATE INDEX IF NOT EXISTS "Cupom_ativo_fimEm_idx" ON "Cupom"("ativo", "fimEm");
CREATE UNIQUE INDEX IF NOT EXISTS "CupomUso_vendaId_key" ON "CupomUso"("vendaId");
CREATE INDEX IF NOT EXISTS "CupomUso_cupomId_createdAt_idx" ON "CupomUso"("cupomId", "createdAt");
CREATE INDEX IF NOT EXISTS "CupomUso_clienteId_idx" ON "CupomUso"("clienteId");
CREATE INDEX IF NOT EXISTS "Venda_cupomId_idx" ON "Venda"("cupomId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Venda_cupomId_fkey') THEN
        ALTER TABLE "Venda" ADD CONSTRAINT "Venda_cupomId_fkey"
        FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CupomUso_cupomId_fkey') THEN
        ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_cupomId_fkey"
        FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CupomUso_vendaId_fkey') THEN
        ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_vendaId_fkey"
        FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CupomUso_clienteId_fkey') THEN
        ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_clienteId_fkey"
        FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
