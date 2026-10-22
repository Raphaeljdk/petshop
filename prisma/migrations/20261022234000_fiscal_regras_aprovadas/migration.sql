-- Cadastro de regras fiscais específicas, sem tocar em dados já existentes.
-- Somente códigos e percentuais revisados; nenhuma emissão de NF-e é liberada.
CREATE TABLE "RegraFiscalAprovada" (
  "id" TEXT NOT NULL,
  "ncm" TEXT NOT NULL,
  "cfop" TEXT NOT NULL,
  "ufDestino" TEXT NOT NULL DEFAULT 'SP',
  "origem" TEXT NOT NULL,
  "indicadorIE" TEXT NOT NULL DEFAULT '9',
  "csosn" TEXT NOT NULL,
  "cest" TEXT,
  "pisCst" TEXT NOT NULL,
  "cofinsCst" TEXT NOT NULL,
  "ipiCst" TEXT,
  "ibsCbsCst" TEXT,
  "ibsCbsClassTrib" TEXT,
  "aliquotaIcmsSt" DOUBLE PRECISION,
  "aliquotaPis" DOUBLE PRECISION,
  "aliquotaCofins" DOUBLE PRECISION,
  "aliquotaIpi" DOUBLE PRECISION,
  "aliquotaFcpSt" DOUBLE PRECISION,
  "aliquotaIbsUf" DOUBLE PRECISION,
  "aliquotaIbsMun" DOUBLE PRECISION,
  "aliquotaCbs" DOUBLE PRECISION,
  "contadorResponsavel" TEXT NOT NULL,
  "referencia" TEXT NOT NULL,
  "observacoes" TEXT,
  "vigenteDesde" TIMESTAMP(3),
  "vigenteAte" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "aprovadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegraFiscalAprovada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegraFiscalAprovada_ncm_cfop_ufDestino_origem_indicadorIE_key"
  ON "RegraFiscalAprovada"("ncm","cfop","ufDestino","origem","indicadorIE");
CREATE INDEX "RegraFiscalAprovada_ncm_ufDestino_ativo_idx"
  ON "RegraFiscalAprovada"("ncm","ufDestino","ativo");
