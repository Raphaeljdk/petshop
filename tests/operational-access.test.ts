import { describe, expect, test } from 'bun:test'
import { isAndreOperator, canViewAppointments, canScheduleBath, canViewDeliveryAddresses, roleForTeamInvitation } from '../src/lib/operational-access'

describe('permissões individuais do André', () => {
  const andre = { email: 'Andre.MatilhaPrado@gmail.com', role: 'KANBAN' }
  const kanban = { email: 'agenda@matilha.prado@gmail.com', role: 'KANBAN' }
  const cliente = { email: 'andre.matilhaprado@gmail.com', role: 'CLIENTE' }
  test('o André com conta KANBAN pode agendar banho e consultar agenda e endereços', () => {
    expect(isAndreOperator(andre)).toBe(true)
    expect(canViewAppointments(andre)).toBe(true)
    expect(canScheduleBath(andre)).toBe(true)
    expect(canViewDeliveryAddresses(andre)).toBe(true)
  })
  test('outro Kanban ou conta cliente com mesmo e-mail não ganha acesso', () => {
    expect(canViewAppointments(kanban)).toBe(false)
    expect(canViewDeliveryAddresses(kanban)).toBe(false)
    expect(canScheduleBath(cliente)).toBe(false)
    expect(isAndreOperator(cliente)).toBe(false)
    expect(canViewAppointments(null)).toBe(false)
  })
  test('convite do André nunca cria administrador, inclusive com letras maiúsculas', () => {
    expect(roleForTeamInvitation('Andre.MatilhaPrado@gmail.com')).toBe('KANBAN')
    expect(roleForTeamInvitation(' matilhaprado@gmail.com ')).toBe('ADMIN')
  })
  test('ADMIN continua com acesso administrativo normal', () => {
    expect(canViewAppointments({ role: 'ADMIN', email: 'qualquer@empresa.com' })).toBe(true)
  })
})
