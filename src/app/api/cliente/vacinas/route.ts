import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { siggma } from '@/lib/siggma/service'

function normalizeDate(value?: string | null) {
  if (!value) return null
  const raw = value.trim()
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (br) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = br
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`
  }
  const normalized = raw.replace(' ', 'T')
  return Number.isNaN(new Date(normalized).getTime()) ? null : normalized
}

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario || !usuario.cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }

    if (!usuario.siggmaCliCod) {
      return NextResponse.json({ data: [], linked: false })
    }

    const first = await siggma.animais.listar({
      cliente: usuario.siggmaCliCod,
      pagina: 1,
    })
    const animals = [...(first.data || [])]
    const pages = Math.max(Number(first.metadata?.paginas || 1), 1)

    for (let page = 2; page <= pages; page += 1) {
      const current = await siggma.animais.listar({
        cliente: usuario.siggmaCliCod,
        pagina: page,
      })
      animals.push(...(current.data || []))
    }

    const rows = await Promise.all(
      animals.map(async (animal) => {
        const firstVaccines = await siggma.vacinas.listar({ animal: animal.id, pagina: 1 })
        const vaccines = [...(firstVaccines.data || [])]
        const vaccinePages = Math.max(Number(firstVaccines.metadata?.paginas || 1), 1)

        for (let page = 2; page <= vaccinePages; page += 1) {
          const current = await siggma.vacinas.listar({ animal: animal.id, pagina: page })
          vaccines.push(...(current.data || []))
        }

        return vaccines.map((vaccine) => {
          const appliedAt = normalizeDate(vaccine.dataHora)
          let nextDoseAt: string | null = null
          if (appliedAt && vaccine.intervaloDias && vaccine.intervaloDias > 0) {
            const next = new Date(appliedAt)
            next.setDate(next.getDate() + vaccine.intervaloDias)
            nextDoseAt = next.toISOString()
          }

          return {
            id: vaccine.id,
            petId: animal.id,
            petNome: animal.nome || 'Pet',
            descricao: vaccine.descricao || 'Vacina',
            observacoes: vaccine.observacoes || null,
            status: vaccine.status || null,
            terceiros: Boolean(vaccine.terceiros),
            aplicadaEm: appliedAt,
            intervaloDias: vaccine.intervaloDias || null,
            proximaDoseEm: nextDoseAt,
          }
        })
      })
    )

    return NextResponse.json({
      linked: true,
      data: rows.flat().sort((a, b) =>
        String(b.aplicadaEm || '').localeCompare(String(a.aplicadaEm || ''))
      ),
    })
  } catch (error) {
    console.error('[cliente/vacinas] erro:', error)
    return NextResponse.json({ error: 'Erro ao consultar vacinas no Siggma' }, { status: 500 })
  }
}
