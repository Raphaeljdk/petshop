CREATE TABLE "AgendaEvento" (
  "id" TEXT NOT NULL,
  "agendamentoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "detalhe" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaEvento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgendaEvento_agendamentoId_createdAt_idx" ON "AgendaEvento"("agendamentoId","createdAt");
