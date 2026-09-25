CREATE TABLE "MercadoLivreConnection" (
  "id" TEXT NOT NULL DEFAULT 'matilha-prado',
  "sellerId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MercadoLivreConnection_pkey" PRIMARY KEY ("id")
);
