-- Um mesmo número de saída da série exclusiva também não pode entrar via conciliação manual.
CREATE UNIQUE INDEX "NotaFiscal_modelo55_serie2_numero_key" ON "NotaFiscal" (numero)
WHERE modelo = '55' AND serie = 2 AND numero IS NOT NULL;
