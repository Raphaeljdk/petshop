-- Migração aditiva para novos vales-presente: telefone de contato obrigatório na API.
-- Registros históricos podem manter recipientEmail, e não são apagados nem alterados.
ALTER TABLE "PortalGiftRequest"
  ADD COLUMN "recipientPhone" TEXT;
