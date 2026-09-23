CREATE TABLE "ClientInvitation" (
  "id" TEXT NOT NULL,
  "siggmaCliCod" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "emailStatus" TEXT NOT NULL DEFAULT 'pending',
  "providerId" TEXT,
  CONSTRAINT "ClientInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientInvitation_siggmaCliCod_key" ON "ClientInvitation"("siggmaCliCod");
CREATE UNIQUE INDEX "ClientInvitation_tokenHash_key" ON "ClientInvitation"("tokenHash");
CREATE INDEX "ClientInvitation_email_idx" ON "ClientInvitation"("email");
