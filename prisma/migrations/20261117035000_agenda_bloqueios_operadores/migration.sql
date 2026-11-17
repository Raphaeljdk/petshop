-- Aditiva: vincula profissionais a contas específicas sem modificar agendamentos históricos.
ALTER TABLE "ProfissionalAgenda" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "ProfissionalAgenda_userId_key" ON "ProfissionalAgenda"("userId");
ALTER TABLE "ProfissionalAgenda" ADD CONSTRAINT "ProfissionalAgenda_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AgendaBloqueio" (
 "id" TEXT NOT NULL,
 "profissionalId" TEXT NOT NULL,
 "inicio" TIMESTAMP(3) NOT NULL,
 "fim" TIMESTAMP(3) NOT NULL,
 "motivo" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AgendaBloqueio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgendaBloqueio_profissionalId_inicio_fim_idx" ON "AgendaBloqueio"("profissionalId","inicio","fim");
ALTER TABLE "AgendaBloqueio" ADD CONSTRAINT "AgendaBloqueio_profissionalId_fkey"
 FOREIGN KEY ("profissionalId") REFERENCES "ProfissionalAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
