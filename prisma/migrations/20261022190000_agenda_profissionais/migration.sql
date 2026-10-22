-- Migração aditiva: nenhum agendamento existente é removido ou reassociado.
CREATE TABLE "ProfissionalAgenda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidades" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfissionalAgenda_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Agendamento" ADD COLUMN "profissionalId" TEXT;
CREATE INDEX "Agendamento_profissionalId_dataHora_idx" ON "Agendamento"("profissionalId", "dataHora");
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_profissionalId_fkey"
  FOREIGN KEY ("profissionalId") REFERENCES "ProfissionalAgenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
