CREATE TABLE "AgendaEscalaSemanal" (
 "diaSemana" INTEGER NOT NULL CHECK ("diaSemana" BETWEEN 0 AND 6),
 "inicio" VARCHAR(5) NOT NULL,
 "fim" VARCHAR(5) NOT NULL,
 "servicos" JSONB NOT NULL DEFAULT '[]',
 "turnos" JSONB NOT NULL DEFAULT '[]',
 "atualizadoPorId" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AgendaEscalaSemanal_pkey" PRIMARY KEY ("diaSemana")
);
