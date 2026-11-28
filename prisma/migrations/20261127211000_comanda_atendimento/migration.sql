ALTER TABLE "Venda" ADD COLUMN "comandaProcessoId" TEXT, ADD COLUMN "comandaCompraKey" TEXT;
CREATE UNIQUE INDEX "Venda_comandaCompraKey_key" ON "Venda"("comandaCompraKey");
CREATE INDEX "Venda_comandaProcessoId_idx" ON "Venda"("comandaProcessoId");
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_comandaProcessoId_fkey" FOREIGN KEY ("comandaProcessoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ComandaServicoExtra" (
 "id" TEXT NOT NULL, "processoId" TEXT NOT NULL, "chaveServico" TEXT NOT NULL, "nome" TEXT NOT NULL,
 "precoCentavos" INTEGER NOT NULL, "duracaoMinutos" INTEGER NOT NULL, "motivo" TEXT, "origem" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'aguardando_tutor', "solicitadoPorId" TEXT NOT NULL, "aceitoPorId" TEXT,
 "respondidoEm" TIMESTAMP(3), "equipePorId" TEXT, "equipeEm" TIMESTAMP(3), "realizadoEm" TIMESTAMP(3),
 "vendaId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ComandaServicoExtra_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ComandaServicoExtra_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ComandaServicoExtra_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ComandaServicoExtra_vendaId_key" ON "ComandaServicoExtra"("vendaId");
CREATE INDEX "ComandaServicoExtra_processoId_status_idx" ON "ComandaServicoExtra"("processoId", "status");
