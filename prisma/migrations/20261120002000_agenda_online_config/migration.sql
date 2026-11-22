-- Configuração explícita da agenda online; sem horários ou reservas fictícios.
CREATE TABLE "AgendaOnlineConfig" (
  "id" TEXT NOT NULL DEFAULT 'padrao',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "diasSemana" TEXT NOT NULL DEFAULT '',
  "abre" TEXT NOT NULL DEFAULT '',
  "fecha" TEXT NOT NULL DEFAULT '',
  "intervaloMinutos" INTEGER NOT NULL DEFAULT 30,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaOnlineConfig_pkey" PRIMARY KEY ("id")
);
