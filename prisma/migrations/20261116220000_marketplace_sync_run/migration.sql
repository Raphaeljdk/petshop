CREATE TABLE "MarketplaceSyncRun" (
  "id" TEXT NOT NULL DEFAULT 'marketplaces',
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'never',
  "lastStartedAt" TIMESTAMP(3),
  "lastFinishedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastMlUpdated" INTEGER NOT NULL DEFAULT 0,
  "lastAmazonUpdated" INTEGER NOT NULL DEFAULT 0,
  "lastSalesImported" INTEGER NOT NULL DEFAULT 0,
  "lastErrors" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceSyncRun_pkey" PRIMARY KEY ("id")
);
