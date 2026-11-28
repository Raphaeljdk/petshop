ALTER TABLE "Processo" ADD COLUMN "agendamentoId" TEXT;
CREATE UNIQUE INDEX "Processo_agendamentoId_key" ON "Processo"("agendamentoId");
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
