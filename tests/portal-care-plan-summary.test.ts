import { describe, expect, test } from 'bun:test'
import { resumirPlanoDeCuidados } from '../src/lib/portal-care-plan-summary'

const agora = new Date('2026-11-19T20:00:00.000Z')
const base = { status: 'ativo', sessionsUsed: 2, expiresAt: '2026-11-30T23:59:59.000Z', plan: { sessions: 5 } }

describe('Resumo de planos no portal', () => {
  test('mostra sessões contratadas, realizadas e saldo real do plano ativo', () => {
    expect(resumirPlanoDeCuidados(base, agora)).toEqual({
      total: 5, utilizadas: 2, restantes: 3, disponiveis: 3, situacao: 'ativo',
    })
  })

  test('plano ainda não aprovado não disponibiliza sessões', () => {
    expect(resumirPlanoDeCuidados({ ...base, status: 'solicitado' }, agora)).toMatchObject({
      restantes: 3, disponiveis: 0, situacao: 'pendente',
    })
  })

  test('plano vencido não pode ter sessões disponíveis, mesmo que reste saldo', () => {
    expect(resumirPlanoDeCuidados({ ...base, expiresAt: '2026-11-18T00:00:00.000Z' }, agora)).toMatchObject({
      restantes: 3, disponiveis: 0, situacao: 'vencido',
    })
  })

  test('plano completo é identificado como concluído', () => {
    expect(resumirPlanoDeCuidados({ ...base, sessionsUsed: 5 }, agora)).toMatchObject({
      restantes: 0, disponiveis: 0, situacao: 'esgotado',
    })
  })

  test('plano cancelado conserva contagem histórica sem liberar sessões', () => {
    expect(resumirPlanoDeCuidados({ ...base, status: 'cancelado' }, agora)).toMatchObject({
      utilizadas: 2, restantes: 3, disponiveis: 0, situacao: 'cancelado',
    })
  })

  test('protege contra contagem inválida/maior que o plano', () => {
    expect(resumirPlanoDeCuidados({ ...base, sessionsUsed: 9 }, agora)).toMatchObject({
      utilizadas: 5, restantes: 0, disponiveis: 0,
    })
    expect(resumirPlanoDeCuidados({ ...base, sessionsUsed: -1 }, agora)).toMatchObject({
      utilizadas: 0, restantes: 5, disponiveis: 5,
    })
  })
})
