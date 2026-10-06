ALTER TABLE "Venda"
ADD COLUMN "marketplaceOrderId" TEXT,
ADD COLUMN "marketplaceBuyerDocument" TEXT,
ADD COLUMN "marketplaceBuyerName" TEXT;

CREATE UNIQUE INDEX "Venda_marketplaceOrderId_key"
ON "Venda"("marketplaceOrderId");
