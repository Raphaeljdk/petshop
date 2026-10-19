-- Compatibilidade para antigos convites: migrar a emissão para cadastros locais.
-- Convites legados só podem ser reemitidos com clienteId válido, nunca vinculados por suposição.
ALTER TABLE "ClientInvitation" ALTER COLUMN "siggmaCliCod" DROP NOT NULL;
ALTER TABLE "ClientInvitation" ADD COLUMN "clienteId" TEXT;
CREATE UNIQUE INDEX "ClientInvitation_clienteId_key" ON "ClientInvitation"("clienteId");
