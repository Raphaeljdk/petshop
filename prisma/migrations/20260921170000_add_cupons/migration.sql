-- CreateTable
CREATE TABLE "Cupom" (
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
ADD COLUMN "subtotalProdutos" DOUBLE PRECISION,
ADD COLUMN "cupomId" TEXT,
ADD COLUMN "cupomCodigo" TEXT,
ADD COLUMN "descontoCupom" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CupomUso" (
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
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");
CREATE INDEX "Cupom_ativo_fimEm_idx" ON "Cupom"("ativo", "fimEm");
CREATE UNIQUE INDEX "CupomUso_vendaId_key" ON "CupomUso"("vendaId");
CREATE INDEX "CupomUso_cupomId_createdAt_idx" ON "CupomUso"("cupomId", "createdAt");
CREATE INDEX "CupomUso_clienteId_idx" ON "CupomUso"("clienteId");
CREATE INDEX "Venda_cupomId_idx" ON "Venda"("cupomId");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_cupomId_fkey"
FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_cupomId_fkey"
FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_vendaId_fkey"
FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CupomUso" ADD CONSTRAINT "CupomUso_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
