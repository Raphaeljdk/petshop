ALTER TABLE "Agendamento" ADD COLUMN "duracaoMinutos" INTEGER;
ALTER TABLE "BookingRequest" ADD COLUMN "agendamentoId" TEXT;
CREATE UNIQUE INDEX "BookingRequest_agendamentoId_key" ON "BookingRequest"("agendamentoId");
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
