-- Colunas aditivas: todas as memórias históricas continuam privadas por padrão.
ALTER TABLE "PortalPetMemory"
  ADD COLUMN "blogConsentAt" TIMESTAMP(3),
  ADD COLUMN "blogStatus" TEXT NOT NULL DEFAULT 'privado',
  ADD COLUMN "blogReviewedAt" TIMESTAMP(3),
  ADD COLUMN "blogReviewedBy" TEXT;

CREATE INDEX "PortalPetMemory_blogStatus_blogConsentAt_createdAt_idx"
  ON "PortalPetMemory"("blogStatus", "blogConsentAt", "createdAt");
