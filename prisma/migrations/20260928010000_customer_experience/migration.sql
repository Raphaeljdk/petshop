-- CreateTable
CREATE TABLE "CustomerPreference" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "reminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPetProfile" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "petKey" TEXT NOT NULL,
    "photo" TEXT,
    "size" TEXT,
    "birthday" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "petKey" TEXT NOT NULL,
    "petName" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "desiredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'solicitado',
    "confirmedAt" TIMESTAMP(3),
    "confirmationRef" TEXT,
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spendCentsPerPoint" INTEGER NOT NULL DEFAULT 100,
    "rewardPoints" INTEGER NOT NULL DEFAULT 100,
    "rewardCents" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "couponCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPreference_clienteId_reminderAt_idx" ON "CustomerPreference"("clienteId", "reminderAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPreference_clienteId_produtoId_key" ON "CustomerPreference"("clienteId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPetProfile_clienteId_petKey_key" ON "CustomerPetProfile"("clienteId", "petKey");

-- CreateIndex
CREATE INDEX "ProductReview_produtoId_hidden_idx" ON "ProductReview"("produtoId", "hidden");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_clienteId_produtoId_key" ON "ProductReview"("clienteId", "produtoId");

-- CreateIndex
CREATE INDEX "BookingRequest_status_desiredAt_idx" ON "BookingRequest"("status", "desiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_clienteId_petKey_desiredAt_key" ON "BookingRequest"("clienteId", "petKey", "desiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRedemption_couponCode_key" ON "LoyaltyRedemption"("couponCode");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_clienteId_idx" ON "LoyaltyRedemption"("clienteId");

-- AddForeignKey
ALTER TABLE "CustomerPreference" ADD CONSTRAINT "CustomerPreference_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPreference" ADD CONSTRAINT "CustomerPreference_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPetProfile" ADD CONSTRAINT "CustomerPetProfile_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;


