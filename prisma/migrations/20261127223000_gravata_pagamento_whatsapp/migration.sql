ALTER TABLE "BookingRequest" ADD COLUMN "gravataIdeia" VARCHAR(400), ADD COLUMN "servicoPrecoCentavos" INTEGER, ADD COLUMN "pagamentoVendaId" TEXT, ADD COLUMN "gravataWhatsStatus" TEXT NOT NULL DEFAULT 'aguardando_pagamento', ADD COLUMN "gravataWhatsId" TEXT, ADD COLUMN "gravataWhatsEnviadoEm" TIMESTAMP(3);
CREATE UNIQUE INDEX "BookingRequest_pagamentoVendaId_key" ON "BookingRequest"("pagamentoVendaId");
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_pagamentoVendaId_fkey" FOREIGN KEY ("pagamentoVendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
