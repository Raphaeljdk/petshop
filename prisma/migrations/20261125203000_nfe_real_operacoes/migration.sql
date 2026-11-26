ALTER TABLE "NfeRealReserva"
  ADD COLUMN "chave" TEXT UNIQUE CHECK ("chave" ~ '^[0-9]{44}$'),
  ADD COLUMN "xmlAssinado" TEXT,
  ADD COLUMN "dadosOperacao" JSONB,
  ADD COLUMN "emitidaEm" TIMESTAMP(3),
  ADD COLUMN "enviadaEm" TIMESTAMP(3),
  ADD COLUMN "consultaAusenteEm" TIMESTAMP(3),
  ADD COLUMN "recibo" TEXT,
  ADD COLUMN "codigo" INTEGER,
  ADD COLUMN "motivo" TEXT,
  ADD COLUMN "revisao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NfeRealReserva" DROP CONSTRAINT "NfeRealReserva_status_check";
ALTER TABLE "NfeRealReserva" ADD CHECK ("status" IN
  ('reservada','preparada','enviando','incerta','recebida','rejeitada','autorizada','cancelada','inutilizada','quebra'));
CREATE TABLE "NfeRealHistorico" (
  "id" TEXT PRIMARY KEY, "reservaId" TEXT NOT NULL REFERENCES "NfeRealReserva"("id") ON DELETE RESTRICT,
  "acao" TEXT NOT NULL, "usuarioId" TEXT NOT NULL, "documento" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "NfeRealHistorico_reservaId_createdAt_idx" ON "NfeRealHistorico"("reservaId", "createdAt");
CREATE TABLE "NfeRealCancelamento" (
  "reservaId" TEXT PRIMARY KEY REFERENCES "NfeRealReserva"("id") ON DELETE RESTRICT,
  "xmlPedido" TEXT NOT NULL, "status" TEXT NOT NULL CHECK ("status" IN ('enviando','incerta','rejeitada','registrada')),
  "protocolo" TEXT, "xmlProcessado" TEXT, "motivo" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Autorizações operacionais por regra, revisão e SKU. Nenhuma é concedida pela migration.
CREATE TABLE "NfeRealAprovacao" (
  "regraId" TEXT NOT NULL REFERENCES "RegraFiscalAprovada"("id") ON DELETE RESTRICT,
  "sku" TEXT NOT NULL, "revisaoRegra" TIMESTAMP(3) NOT NULL,
  "referencia" TEXT NOT NULL CHECK(length(trim("referencia")) >= 5),
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("regraId","sku")
);
