-- Vinculação por sub do Google, sem migração ou fusão automática de clientes legados.
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
