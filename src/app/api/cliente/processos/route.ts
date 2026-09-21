import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import {
  ageLabel,
  getZettaHistoriesByClient,
  historyService,
  normalizeHistoryStatus,
} from '@/lib/zetta-client'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    if (usuario.siggmaCliCod) {
      const histories = await getZettaHistoriesByClient(usuario.siggmaCliCod)
      const now = new Date().toISOString()

      return NextResponse.json(
        histories.map((history) => {
          const createdAt = history.datahora || history.dataAtualizacao || now
          const updatedAt = history.dataAtualizacao || createdAt
          const petUpdatedAt = history.dataAtualizacao || createdAt

          return {
            id: `zetta-h:${history.id}`,
            petId: `zetta:${history.animalId}`,
            status: normalizeHistoryStatus(history),
            servico: historyService(history),
            responsavel: null,
            anamnese: history.quadroClinico || history.observacoes || null,
            inicioAtendimento: history.datahora || null,
            fimAtendimento: history.dataEntregue || null,
            valorServico: 0,
            notificadoEm: null,
            createdAt,
            updatedAt,
            origem: 'zetta' as const,
            statusOriginal: history.status || null,
            notificacoes: [],
            pet: {
              id: `zetta:${history.animalId}`,
              nome: history.animalNome || 'Pet',
              especie: history.especie || 'Pet',
              raca: history.raca || null,
              idade: ageLabel(null),
              peso: history.peso == null ? null : String(history.peso),
              fotoUrl: null,
              observacoes: null,
              clienteId: cliente.id,
              createdAt: petUpdatedAt,
              updatedAt: petUpdatedAt,
              origem: 'zetta' as const,
              zettaId: history.animalId,
            },
          }
        })
      )
    }

    const processos = await db.processo.findMany({
      where: { pet: { clienteId: cliente.id } },
      orderBy: { createdAt: 'desc' },
      include: { pet: true, notificacoes: true },
    })

    return NextResponse.json(
      processos.map((processo) => ({ ...processo, origem: 'local' as const }))
    )
  } catch (e) {
    console.error('cliente/processos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar processos' }, { status: 500 })
  }
}
