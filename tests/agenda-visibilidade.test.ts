import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'

const admin = readFileSync('src/components/agendamentos/AgendamentosView.tsx','utf-8')
const operador = readFileSync('src/components/operacional/AndreOperations.tsx','utf-8')

describe('regressão: histórico de agendamentos visível', () => {
  test('lista administrativa inicia aberta e sem filtro de 7 dias', () => {
    expect(admin).toContain("const [periodo, setPeriodo] = useState('todos')")
    expect(admin).toContain('<details open className="rounded-2xl border bg-card p-3 sm:p-4">')
  })
  test('erro de bloqueios não remove os agendamentos retornados', () => {
    expect(admin).toContain('Promise.allSettled')
    expect(admin.indexOf("resAgenda.status === 'fulfilled'")).toBeLessThan(admin.indexOf("resBloqueios.status === 'fulfilled'"))
    expect(admin).toContain('Falha ao consultar agendamentos:')
  })
  test('operador consulta histórico paginado com erro explícito', () => {
    expect(operador).toContain("'/api/agendamentos?pagina=' + paginaAgenda")
    expect(operador).toContain('totalAgenda > 100')
    expect(operador).toContain('erroAgenda &&')
  })
})
