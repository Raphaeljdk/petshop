ALTER TABLE "Processo" ADD COLUMN "comandaFechadaEm" TIMESTAMP(3), ADD COLUMN "comandaFechadaPorId" TEXT;
ALTER TABLE "ComandaServicoExtra" ADD COLUMN "grupoVendaId" TEXT;
ALTER TABLE "ComandaServicoExtra" ADD CONSTRAINT "ComandaServicoExtra_grupoVendaId_fkey" FOREIGN KEY ("grupoVendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Processo" ADD COLUMN "comandaPrincipalVendaId" TEXT;
CREATE UNIQUE INDEX "Processo_comandaPrincipalVendaId_key" ON "Processo"("comandaPrincipalVendaId");
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_comandaPrincipalVendaId_fkey" FOREIGN KEY ("comandaPrincipalVendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ComandaServicoExtra_grupoVendaId_idx" ON "ComandaServicoExtra"("grupoVendaId");
