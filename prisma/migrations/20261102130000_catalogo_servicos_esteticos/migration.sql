-- Tabela aditiva: não altera dados existentes, notas, estoque, vendas ou agendamentos.
-- Não publica preços automaticamente nem presume tributação.
CREATE TABLE "ServicoEsteticoConfig" (
  "chave" TEXT NOT NULL,
  "precoCentavos" INTEGER,
  "duracaoMinutos" INTEGER,
  "regrasPreco" TEXT,
  "observacoes" TEXT,
  "confirmado" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServicoEsteticoConfig_pkey" PRIMARY KEY ("chave")
);
ALTER TABLE "ServicoEsteticoConfig"
  ADD CONSTRAINT "ServicoEsteticoConfig_preco_nonnegativo"
  CHECK ("precoCentavos" IS NULL OR "precoCentavos" BETWEEN 0 AND 10000000);
ALTER TABLE "ServicoEsteticoConfig"
  ADD CONSTRAINT "ServicoEsteticoConfig_duracao_valida"
  CHECK ("duracaoMinutos" IS NULL OR "duracaoMinutos" BETWEEN 5 AND 720);
