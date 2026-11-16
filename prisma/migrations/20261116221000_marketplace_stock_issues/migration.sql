CREATE TABLE "MarketplaceStockIssue" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "error" TEXT NOT NULL,
  "retryAfter" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStockIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketplaceStockIssue_resolvedAt_retryAfter_idx" ON "MarketplaceStockIssue"("resolvedAt","retryAfter");
