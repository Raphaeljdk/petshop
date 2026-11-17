import {Prisma} from '@prisma/client'

/**
 * Reserva atômica da numeração de homologação (série 2).
 * O PostgreSQL retorna VOID para SELECT pg_advisory_xact_lock(...), tipo que
 * o Prisma não desserializa em certas conexões (P2010).
 * Usar a função no FROM e selecionar BOOLEAN, que o Prisma reconhece.
 * O bloqueio é transacional e liberado ao encerrar a mesma transação.
 */
export const BLOQUEIO_NUMERACAO_HOMOLOGACAO=Prisma.sql`SELECT true AS locked FROM pg_advisory_xact_lock(${BigInt('57199062000191')}::bigint)`
export const bloqueioNumeracaoValido=(rows:ReadonlyArray<{locked:boolean}>)=>
  rows.length===1&&rows[0]?.locked===true
