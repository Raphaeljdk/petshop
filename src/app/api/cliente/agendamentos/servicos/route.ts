import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-helpers'

type Servico = { id: number; tipo: string; descricao: string | null }

function envServices(): Servico[] {
  const raw = process.env.SIGGMA_SERVICE_OPTIONS?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      if (!item || typeof item !== 'object') return null
      const value = item as Record<string, unknown>
      const id = Number.parseInt(String(value.id || ''), 10)
      const tipo = String(value.tipo || value.nome || '').trim()
      const descricao = String(value.descricao || '').trim() || null
      if (!Number.isFinite(id) || id < 1 || !tipo) return null
      return { id, tipo, descricao }
    }).filter((item): item is Servico => item !== null)
  } catch {
    return []
  }
}

export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario || !usuario.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
  if (!usuario.siggmaCliCod) return NextResponse.json({ data: [], source: 'local' })

  const fallback = envServices()
  if (fallback.length > 0) return NextResponse.json({ data: fallback, source: 'environment' })

  return NextResponse.json({
    error: 'Configure SIGGMA_SERVICE_OPTIONS com os IDs de petshop_tipos_servicos até a bridge Oracle expor essa tabela.',
    data: [],
  }, { status: 503 })
}
