CREATE TABLE "ImportacaoFiscalProduto" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "sku" TEXT,
  "fonte" TEXT NOT NULL,
  "arquivo" TEXT NOT NULL,
  "hashArquivo" TEXT NOT NULL,
  "linha" INTEGER NOT NULL,
  "camposAlterados" TEXT NOT NULL,
  "ncmAnterior" TEXT,
  "ncmNovo" TEXT,
  "cestAnterior" TEXT,
  "cestNovo" TEXT,
  "gtinAnterior" TEXT,
  "gtinNovo" TEXT,
  "origemAnterior" TEXT,
  "origemNova" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportacaoFiscalProduto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportacaoFiscalProduto_produtoId_criadoEm_idx" ON "ImportacaoFiscalProduto" ("produtoId", "criadoEm");
CREATE INDEX "ImportacaoFiscalProduto_hashArquivo_idx" ON "ImportacaoFiscalProduto" ("hashArquivo");