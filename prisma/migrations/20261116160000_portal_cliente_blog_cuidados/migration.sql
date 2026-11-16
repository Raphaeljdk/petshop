-- Isolated customer portal modules. No mutations to NF-e, Siggma or existing orders.
CREATE TABLE "PortalArticle" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "category" TEXT NOT NULL,
  "summary" TEXT NOT NULL, "body" TEXT NOT NULL, "imageUrl" TEXT,
  "productId" TEXT, "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalArticle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PortalArticle_published_createdAt_idx" ON "PortalArticle"("published", "createdAt");

CREATE TABLE "PortalArticleFavorite" (
  "id" TEXT NOT NULL, "articleId" TEXT NOT NULL, "clienteId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalArticleFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalArticleFavorite_articleId_clienteId_key" ON "PortalArticleFavorite"("articleId","clienteId");
CREATE INDEX "PortalArticleFavorite_clienteId_idx" ON "PortalArticleFavorite"("clienteId");
ALTER TABLE "PortalArticleFavorite" ADD CONSTRAINT "PortalArticleFavorite_articleId_fkey"
 FOREIGN KEY ("articleId") REFERENCES "PortalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PortalPetMemory" (
  "id" TEXT NOT NULL, "clienteId" TEXT NOT NULL, "petKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "notes" TEXT,
  "weightKg" DOUBLE PRECISION, "imageData" TEXT,
  "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAt" TIMESTAMP(3), "processoId" TEXT,
  "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalPetMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PortalPetMemory_clienteId_petKey_eventAt_idx" ON "PortalPetMemory"("clienteId","petKey","eventAt");
CREATE INDEX "PortalPetMemory_processoId_idx" ON "PortalPetMemory"("processoId");

CREATE TABLE "PortalClientPreferences" (
  "clienteId" TEXT NOT NULL, "remindersInApp" BOOLEAN NOT NULL DEFAULT true,
  "remindersEmail" BOOLEAN NOT NULL DEFAULT false,
  "remindersWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "marketingEmail" BOOLEAN NOT NULL DEFAULT false,
  "marketingWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "groomingPhotoConsent" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalClientPreferences_pkey" PRIMARY KEY ("clienteId")
);

CREATE TABLE "PortalCarePlan" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "sessions" INTEGER NOT NULL, "durationDays" INTEGER NOT NULL DEFAULT 30,
  "priceCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalCarePlan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortalCarePlanRequest" (
  "id" TEXT NOT NULL, "clienteId" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "petKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'solicitado',
  "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalCarePlanRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PortalCarePlanRequest_clienteId_status_idx" ON "PortalCarePlanRequest"("clienteId","status");
ALTER TABLE "PortalCarePlanRequest" ADD CONSTRAINT "PortalCarePlanRequest_planId_fkey"
 FOREIGN KEY ("planId") REFERENCES "PortalCarePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PortalReferral" (
  "id" TEXT NOT NULL, "clienteId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalReferral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalReferral_clienteId_key" ON "PortalReferral"("clienteId");
CREATE UNIQUE INDEX "PortalReferral_code_key" ON "PortalReferral"("code");

CREATE TABLE "PortalReferralClaim" (
  "id" TEXT NOT NULL, "inviterId" TEXT NOT NULL, "invitedId" TEXT NOT NULL,
  "code" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'aguardando_compra',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "PortalReferralClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalReferralClaim_invitedId_key" ON "PortalReferralClaim"("invitedId");
CREATE INDEX "PortalReferralClaim_inviterId_status_idx" ON "PortalReferralClaim"("inviterId","status");

CREATE TABLE "PortalGiftRequest" (
  "id" TEXT NOT NULL, "clienteId" TEXT NOT NULL, "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT, "message" TEXT,
  "amountCents" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'solicitado',
  "voucherCode" TEXT, "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalGiftRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalGiftRequest_voucherCode_key" ON "PortalGiftRequest"("voucherCode");
CREATE INDEX "PortalGiftRequest_clienteId_status_idx" ON "PortalGiftRequest"("clienteId","status");

CREATE TABLE "PortalPetFamilyInvite" (
  "id" TEXT NOT NULL, "ownerClienteId" TEXT NOT NULL,
  "petKey" TEXT NOT NULL, "recipientEmail" TEXT NOT NULL,
  "recipientClienteId" TEXT, "status" TEXT NOT NULL DEFAULT 'pendente',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "PortalPetFamilyInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalPetFamilyInvite_ownerClienteId_petKey_recipientEmail_key" ON "PortalPetFamilyInvite"("ownerClienteId","petKey","recipientEmail");
CREATE INDEX "PortalPetFamilyInvite_recipientEmail_status_idx" ON "PortalPetFamilyInvite"("recipientEmail","status");
