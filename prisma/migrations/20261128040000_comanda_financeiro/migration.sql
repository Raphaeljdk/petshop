ALTER TABLE "Processo" ADD COLUMN "comandaFechadaEm" TIMESTAMP(3), ADD COLUMN "comandaFechadaPorId" TEXT;
ALTER TABLE "ComandaServicoExtra" ADD COLUMN "grupoVendaId" TEXT;
ALTER TABLE "ComandaServicoExtra" ADD CONSTRAINT "ComandaServicoExtra_grupoVendaId_fkey" FOREIGN KEY ("grupoVendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
