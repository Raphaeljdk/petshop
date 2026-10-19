import { afterAll, describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { db } from '../src/lib/db'

const suffix = randomBytes(6).toString('hex')
const createdClientes: string[] = []
const createdAgenda: string[] = []

afterAll(async () => {
  if (createdAgenda.length) {
    await db.agendaEvento.deleteMany({ where: { agendamentoId: { in: createdAgenda } } })
    await db.agendamento.deleteMany({ where: { id: { in: createdAgenda } } })
  }
  if (createdClientes.length) {
    await db.processo.deleteMany({ where: { pet: { clienteId: { in: createdClientes } } } })
    await db.pet.deleteMany({ where: { clienteId: { in: createdClientes } } })
    await db.cliente.deleteMany({ where: { id: { in: createdClientes } } })
  }
  await db.$disconnect()
})

describe('ERP próprio: cadastros e agenda', () => {
  test('cria tutor com vários pets em uma única transação', async () => {
    const cliente = await db.cliente.create({
      data: {
        nome: 'Tutor QA ' + suffix, telefone: '11999999999', email: 'tutor-' + suffix + '@example.test',
        pets: { create: [
          { nome: 'Mel', especie: 'Cão', porte: 'Pequeno', castrado: true },
          { nome: 'Luna', especie: 'Gato', cor: 'Cinza', castrado: false },
        ] },
      },
      include: { pets: true },
    })
    createdClientes.push(cliente.id)
    expect(cliente.ativo).toBe(true)
    expect(cliente.pets).toHaveLength(2)
    expect(cliente.pets.every(p => p.ativo)).toBe(true)
    expect(cliente.pets.some(p => p.porte === 'Pequeno')).toBe(true)
  })

  test('agenda, remarca e cancela sem perder os dados dos pets', async () => {
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: createdClientes[0] }, include: { pets: true } })
    const pet = cliente.pets[0]
    const original = new Date('2026-12-10T14:00:00.000Z')
    const novo = new Date('2026-12-10T16:00:00.000Z')
    const agendamento = await db.agendamento.create({ data: { clienteId: cliente.id, petId: pet.id, servico: 'Banho', dataHora: original } })
    createdAgenda.push(agendamento.id)
    await db.agendaEvento.create({ data: { agendamentoId: agendamento.id, acao: 'criado', autorId: 'qa' } })
    await db.agendamento.update({ where: { id: agendamento.id }, data: { dataHora: novo, observacoes: 'Sem perfume' } })
    await db.agendaEvento.create({ data: { agendamentoId: agendamento.id, acao: 'remarcado', autorId: 'qa' } })
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: 'cancelado' } })
    await db.agendaEvento.create({ data: { agendamentoId: agendamento.id, acao: 'cancelado', autorId: 'qa' } })
    const atual = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id }, include: { pet: true } })
    const eventos = await db.agendaEvento.findMany({ where: { agendamentoId: agendamento.id }, orderBy: { createdAt: 'asc' } })
    expect(atual.dataHora.toISOString()).toBe(novo.toISOString())
    expect(atual.status).toBe('cancelado')
    expect(atual.pet.id).toBe(pet.id)
    expect(eventos.map(e => e.acao)).toEqual(['criado','remarcado','cancelado'])
  })

  test('inativa cliente e pet sem apagar agendamentos históricos', async () => {
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: createdClientes[0] }, include: { pets: true } })
    await db.cliente.update({ where: { id: cliente.id }, data: { ativo: false } })
    await db.pet.update({ where: { id: cliente.pets[0].id }, data: { ativo: false } })
    expect(await db.cliente.count({ where: { id: cliente.id, ativo: true } })).toBe(0)
    expect(await db.pet.count({ where: { id: cliente.pets[0].id, ativo: true } })).toBe(0)
    expect(await db.agendamento.count({ where: { id: { in: createdAgenda } } })).toBe(1)
  })
})
