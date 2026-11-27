CREATE TABLE "AgendaServicoDia" (
  "dia" VARCHAR(10) NOT NULL,
  "servicos" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "atualizadoPorId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgendaServicoDia_pkey" PRIMARY KEY ("dia")
);
