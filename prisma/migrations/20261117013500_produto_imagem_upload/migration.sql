-- Fotos privadas na escrita, públicas apenas pelo identificador de imagem.
-- Nenhum produto, SKU, estoque ou registro fiscal é modificado.
CREATE TABLE "ProdutoImagem" (
  "id" TEXT NOT NULL,
  "conteudo" BYTEA NOT NULL,
  "tipo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProdutoImagem_pkey" PRIMARY KEY ("id")
);
