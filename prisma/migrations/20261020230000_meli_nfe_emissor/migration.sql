-- Identificação do emissor e conciliação de emissões externas.
-- Nunca inventar XML/chave: a SEFAZ/Mercado Livre é a fonte do documento.
ALTER TABLE "NotaFiscal" ADD COLUMN "emissor" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "emissorDocumentoId" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "emissaoSolicitadaEm" TIMESTAMP(3);
ALTER TABLE "NotaFiscal" ADD COLUMN "consultadaEm" TIMESTAMP(3);
