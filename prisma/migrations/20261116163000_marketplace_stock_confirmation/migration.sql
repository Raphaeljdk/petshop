CREATE TABLE "MarketplaceStockConfirmation" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "mlItemId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "previousStock" INTEGER NOT NULL,
  "confirmedStock" INTEGER NOT NULL,
  "marketplaceStockSeen" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStockConfirmation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketplaceStockConfirmation_productId_createdAt_idx" ON "MarketplaceStockConfirmation"("productId","createdAt");
