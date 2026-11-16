-- Campos opcionais de conteúdo e consentimento; todos os cadastros antigos mantêm opt-in desligado.
ALTER TABLE "PortalArticle" ADD COLUMN "readMinutes" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "PortalArticle" ADD COLUMN "publishAt" TIMESTAMP(3);
ALTER TABLE "PortalClientPreferences" ADD COLUMN "publicPetConsent" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "PortalClientPreferences" ADD COLUMN "publicPetConsentAt" TIMESTAMP(3);
