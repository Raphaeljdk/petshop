// GET /api/cliente/dashboard - dados agregados para a tela inicial do cliente
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import {
  getZettaAnimalsByClient,
  getZettaHistoriesByClient,
  historyService,
  normalizeHistoryStatus,
} from '@/lib/zetta-client'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let petsResumo: Array<{
      id: string
      nome: string
      especie: string
      raca: string | null
      fotoUrl: string | null
      ultimoProcesso: {
        status: string
        servico: string
        createdAt: string
      } | null
    }> = []
    let processosAtivos = 0

    if (usuario.siggmaCliCod) {
      const [animais, historicos] = await Promise.all([
        getZettaAnimalsByClient(usuario.siggmaCliCod),
        getZettaHistoriesByClient(usuario.siggmaCliCod),
      ])

      const ultimoPorAnimal = new Map<number, (typeof historicos)[number]>()
      for (const historico of historicos) {
        if (!ultimoPorAnimal.has(historico.animalId)) {
          ultimoPorAnimal.set(historico.animalId, historico)
        }
        const status = normalizeHistoryStatus(historico)
        if (status === 'em_andamento' || status === 'aguardando_resposta') {
          processosAtivos += 1
        }
      }

      petsResumo = animais.map((animal) => {
        const ultimo = ultimoPorAnimal.get(animal.id)
        return {
          id: `zetta:${animal.id}`,
          nome: animal.nome,
          especie: animal.especie || 'Pet',
          raca: animal.raca || null,
          fotoUrl: null,
          ultimoProcesso: ultimo
            ? {
                status: normalizeHistoryStatus(ultimo),
                servico: historyService(ultimo),
                createdAt:
                  ultimo.datahora ||
                  ultimo.dataAtualizacao ||
                  new Date().toISOString(),
              }
            : null,
        }
      })
    } else {
      const pets = await db.pet.findMany({
        where: { clienteId: cliente.id },
        include: {
          processos: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })

      const petIds = pets.map((pet) => pet.id)
      processosAtivos = await db.processo.count({
        where: {
          petId: { in: petIds },
          status: { in: ['novo', 'em_andamento'] },
        },
      })

      petsResumo = pets.map((pet) => ({
        id: pet.id,
        nome: pet.nome,
        especie: pet.especie,
        raca: pet.raca,
        fotoUrl: pet.fotoUrl,
        ultimoProcesso: pet.processos[0]
          ? {
              status: pet.processos[0].status,
              servico: pet.processos[0].servico,
              createdAt: pet.processos[0].createdAt.toISOString(),
            }
          : null,
      }))
    }

    const agora = new Date()
    const proximosAgendamentos = await db.agendamento.findMany({
      where: {
        clienteId: cliente.id,
        dataHora: { gte: agora },
        status: { in: ['agendado', 'confirmado'] },
      },
      include: {
        pet: {
          select: { id: true, nome: true, especie: true, fotoUrl: true },
        },
      },
      orderBy: { dataHora: 'asc' },
      take: 3,
    })

    const ultimasCompras = await db.venda.findMany({
      where: { clienteId: cliente.id },
      include: {
        itens: {
          include: {
            produto: { select: { nome: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    const todasVendas = await db.venda.findMany({
      where: {
        clienteId: cliente.id,
        status: { in: ['concluida', 'paga', 'enviada'] },
      },
      select: { total: true },
    })
    const totalGasto = todasVendas.reduce((acc, venda) => acc + venda.total, 0)

    const produtosDestaque = await db.produto.findMany({
      where: { ativo: true, estoque: { gt: 0 } },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        preco: true,
        precoPromo: true,
        imageUrl: true,
        categoria: true,
      },
    })

    return NextResponse.json({
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        cep: cliente.cep,
      },
      zettaLinked: Boolean(usuario.siggmaCliCod),
      stats: {
        totalPets: petsResumo.length,
        totalAgendamentos: proximosAgendamentos.length,
        totalCompras: todasVendas.length,
        totalGasto,
        processosAtivos,
      },
      pets: petsResumo,
      proximosAgendamentos,
      ultimasCompras: ultimasCompras.map((venda) => ({
        id: venda.id,
        total: venda.total,
        status: venda.status,
        createdAt: venda.createdAt,
        itens: venda.itens.map((item) => ({
          quantidade: item.quantidade,
          nome: item.produto?.nome || '',
          imageUrl: item.produto?.imageUrl,
        })),
      })),
      produtosDestaque,
    })
  } catch (e) {
    console.error('cliente dashboard erro:', e)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
