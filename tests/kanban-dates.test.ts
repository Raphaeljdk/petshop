import { describe, expect, test } from 'bun:test'
import { dataLocalIso, processoNoDia, processoVisivelNoKanban } from '../src/lib/kanban-dates'

describe('Kanban por dia', () => {
  test('o dia é montado no horário local da operação', () => {
    expect(dataLocalIso(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16')
    expect(dataLocalIso(new Date(2026, 10, 17, 0, 1))).toBe('2026-11-17')
  })

  test('um atendimento aparece somente no dia local de abertura', () => {
    const abertura = new Date(2026, 10, 16, 14, 30)
    expect(processoNoDia(abertura.toISOString(), '2026-11-16')).toBe(true)
    expect(processoNoDia(abertura.toISOString(), '2026-11-17')).toBe(false)
  })

  test('cancelamentos ficam fora do quadro mas não são apagados', () => {
    const processo = { createdAt: new Date(2026, 10, 16, 9).toISOString(), status: 'cancelado' }
    expect(processoVisivelNoKanban(processo, '2026-11-16')).toBe(false)
    expect(processoNoDia(processo.createdAt, '2026-11-16')).toBe(true)
    expect(processoVisivelNoKanban({ ...processo, status: 'novo' }, '2026-11-16')).toBe(true)
  })

  test('datas inválidas não entram em nenhum dia', () => {
    expect(processoNoDia('inválida', '2026-11-16')).toBe(false)
    expect(processoNoDia(new Date().toISOString(), 'dia-inválido')).toBe(false)
  })
})
