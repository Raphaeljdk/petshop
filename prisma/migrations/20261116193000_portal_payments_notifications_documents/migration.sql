-- Follow-up to the client portal MVP migration. Apply only in isolated Neon staging first.
ALTER TABLE "PortalCarePlanRequest"
 ADD COLUMN "providerSubscriptionId" TEXT,
 ADD COLUMN "providerCheckoutUrl" TEXT,
 ADD COLUMN "providerStatus" TEXT,
 ADD COLUMN "providerSyncedAt" TIMESTAMP(3),
 ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "PortalCarePlanRequest_providerSubscriptionId_key" ON "PortalCarePlanRequest"("providerSubscriptionId");

ALTER TABLE "PortalReferralClaim" ADD COLUMN "rewardCouponId" TEXT;
ALTER TABLE "PortalGiftRequest" ADD COLUMN "balanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Venda" ADD COLUMN "creditoPresenteCentavos" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PortalCarePlanPayment" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "providerPaymentId" TEXT NOT NULL,
  "status" TEXT NOT NULL, "paidAt" TIMESTAMP(3), "amountCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalCarePlanPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalCarePlanPayment_providerPaymentId_key" ON "PortalCarePlanPayment"("providerPaymentId");
CREATE INDEX "PortalCarePlanPayment_requestId_paidAt_idx" ON "PortalCarePlanPayment"("requestId","paidAt");
ALTER TABLE "PortalCarePlanPayment" ADD CONSTRAINT "PortalCarePlanPayment_requestId_fkey"
 FOREIGN KEY ("requestId") REFERENCES "PortalCarePlanRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PortalGiftRedemption" (
  "id" TEXT NOT NULL, "giftId" TEXT NOT NULL, "saleId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'reservado',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalGiftRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalGiftRedemption_saleId_key" ON "PortalGiftRedemption"("saleId");
CREATE INDEX "PortalGiftRedemption_giftId_status_idx" ON "PortalGiftRedemption"("giftId","status");
ALTER TABLE "PortalGiftRedemption" ADD CONSTRAINT "PortalGiftRedemption_giftId_fkey"
 FOREIGN KEY ("giftId") REFERENCES "PortalGiftRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalGiftRedemption" ADD CONSTRAINT "PortalGiftRedemption_saleId_fkey"
 FOREIGN KEY ("saleId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PortalReferralConfig" (
  "id" TEXT NOT NULL DEFAULT 'default', "active" BOOLEAN NOT NULL DEFAULT false,
  "awardCents" INTEGER NOT NULL DEFAULT 0,
  "minimumPurchaseCents" INTEGER NOT NULL DEFAULT 0,
  "validDays" INTEGER NOT NULL DEFAULT 30, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalReferralConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortalMessageDelivery" (
  "id" TEXT NOT NULL, "uniqueKey" TEXT NOT NULL, "clienteId" TEXT NOT NULL,
  "channel" TEXT NOT NULL, "kind" TEXT NOT NULL, "templateName" TEXT,
  "text" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pendente',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerId" TEXT, "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalMessageDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalMessageDelivery_uniqueKey_key" ON "PortalMessageDelivery"("uniqueKey");
CREATE INDEX "PortalMessageDelivery_status_nextAttemptAt_idx" ON "PortalMessageDelivery"("status","nextAttemptAt");
CREATE INDEX "PortalMessageDelivery_clienteId_createdAt_idx" ON "PortalMessageDelivery"("clienteId","createdAt");

CREATE TABLE "PortalPetDocument" (
  "id" TEXT NOT NULL, "clienteId" TEXT NOT NULL, "petKey" TEXT NOT NULL,
  "title" TEXT NOT NULL, "fileName" TEXT NOT NULL, "fileData" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalPetDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PortalPetDocument_clienteId_petKey_idx" ON "PortalPetDocument"("clienteId","petKey");
