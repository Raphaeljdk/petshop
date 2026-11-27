ALTER TABLE "Processo" ADD COLUMN "bookingRequestId" TEXT;
CREATE UNIQUE INDEX "Processo_bookingRequestId_key" ON "Processo"("bookingRequestId");
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
