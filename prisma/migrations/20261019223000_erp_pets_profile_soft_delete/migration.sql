-- Soft delete protege histórico fiscal, convites, agendas e processos.
ALTER TABLE "Cliente" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Pet" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Pet" ADD COLUMN "porte" TEXT;
ALTER TABLE "Pet" ADD COLUMN "sexo" TEXT;
ALTER TABLE "Pet" ADD COLUMN "nascimento" TIMESTAMP(3);
ALTER TABLE "Pet" ADD COLUMN "cor" TEXT;
ALTER TABLE "Pet" ADD COLUMN "castrado" BOOLEAN;
CREATE INDEX "Agendamento_dataHora_status_idx" ON "Agendamento"("dataHora", "status");
