-- Registro fiscal: não emite nota sem autorização da SEFAZ.
ALTER TABLE "Produto"
 ADD COLUMN "ncm" TEXT,
 ADD COLUMN "cest" TEXT,
 ADD COLUMN "cfop" TEXT,
 ADD COLUMN "origem" TEXT DEFAULT '0',
 ADD COLUMN "cst" TEXT,
 ADD COLUMN "csosn" TEXT,
 ADD COLUMN "unidadeFiscal" TEXT DEFAULT 'UN';

CREATE TABLE "ConfiguracaoFiscal" (
 "id" TEXT NOT NULL DEFAULT 'matilha-prado',
 "razaoSocial" TEXT,
 "nomeFantasia" TEXT,
 "cnpj" TEXT,
 "inscricaoEstadual" TEXT,
 "regimeTributario" TEXT,
 "logradouro" TEXT,
 "numeroEndereco" TEXT,
 "bairro" TEXT,
 "cidade" TEXT,
 "uf" TEXT,
 "cep" TEXT,
 "codigoMunicipio" TEXT,
 "serieNfe" INTEGER NOT NULL DEFAULT 1,
 "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ConfiguracaoFiscal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotaFiscal" (
 "id" TEXT NOT NULL,
 "vendaId" TEXT NOT NULL,
 "modelo" TEXT NOT NULL DEFAULT '55',
 "status" TEXT NOT NULL DEFAULT 'rascunho',
 "numero" INTEGER,
 "serie" INTEGER,
 "chaveAcesso" TEXT,
 "protocolo" TEXT,
 "xmlAutorizado" TEXT,
 "danfeUrl" TEXT,
 "erro" TEXT,
 "autorizadaEm" TIMESTAMP(3),
 "canceladaEm" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotaFiscal_vendaId_key" ON "NotaFiscal"("vendaId");
CREATE UNIQUE INDEX "NotaFiscal_chaveAcesso_key" ON "NotaFiscal"("chaveAcesso");
CREATE INDEX "NotaFiscal_status_createdAt_idx" ON "NotaFiscal"("status","createdAt");
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
