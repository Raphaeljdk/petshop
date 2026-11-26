CREATE TABLE "NfeRealInutilizacao" (
  "reservaId" TEXT PRIMARY KEY REFERENCES "NfeRealReserva"("id") ON DELETE RESTRICT,
  "xmlPedido" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('enviando','incerta','rejeitada','aceita')),
  "protocolo" TEXT, "xmlProcessado" TEXT, "motivo" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
