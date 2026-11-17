'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, RefreshCw, Search, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { AtendimentoFichaDialog } from '@/components/atendimentos/AtendimentoFichaDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dataLocalIso } from '@/lib/kanban-dates'
import type { Processo } from '@/lib/types'

type RegistroAnamnese = Processo & {
  ficha?: {
    checkinStatus: string
    checkinSubmittedAt: string | null
    tutorAceiteAt: string | null
    checkoutFinalizadoAt: string | null
  } | null
}

const situacoes: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente_aceite: 'Aguardando aceite',
  aceito: 'Aceite registrado',
  recusado: 'Aceite recusado',
}

export function AnamneseView() {
  const [registros, setRegistros] = useState<RegistroAnamnese[]>([])
  const [busca, setBusca] = useState('')
  const [dia, setDia] = useState('')
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<Processo | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resposta = await fetch('/api/processos', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Não foi possível carregar as fichas.')
      const dados: RegistroAnamnese[] = await resposta.json()
      setRegistros(dados.filter((p) => Boolean(p.requiresFicha || p.ficha || p.anamnese)))
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao carregar fichas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return registros.filter((p) => {
      if (dia && dataLocalIso(new Date(p.createdAt)) !== dia) return false
      if (!termo) return true
      return [p.pet?.nome, p.pet?.cliente?.nome, p.servico, p.anamnese]
        .some((valor) => (valor || '').toLocaleLowerCase('pt-BR').includes(termo))
    })
  }, [registros, busca, dia])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold">
            <Stethoscope className="size-6" /> Ficha de Anamnese
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte fichas de check-in, aceite do tutor e check-out. Registros cancelados permanecem no histórico.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void carregar()}>
          <RefreshCw className="mr-1 size-4" /> Atualizar
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar fichas" className="pl-9" placeholder="Buscar pet, tutor ou serviço..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Input type="date" aria-label="Filtrar fichas por data" value={dia} onChange={(e) => setDia(e.target.value)} className="sm:w-44" />
        {dia && <Button type="button" variant="ghost" size="sm" onClick={() => setDia('')}>Todas as datas</Button>}
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        {loading ? 'Carregando fichas...' : `${visiveis.length} registro(s) encontrado(s)`}
      </p>
      {!loading && visiveis.length === 0 && (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          Nenhuma ficha encontrada para os filtros selecionados.
        </div>
      )}
      <div className="space-y-2">
        {visiveis.map((p) => {
          const status = p.ficha?.checkinStatus
          const legado = !p.ficha && !p.requiresFicha
          return (
            <article key={p.id} className="rounded-xl border bg-card p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{p.pet?.nome || 'Pet não informado'}</h2>
                    <Badge variant="outline">
                      {legado ? 'Anamnese anterior' : status ? (situacoes[status] || status) : 'Sem preenchimento'}
                    </Badge>
                    {p.ficha?.checkoutFinalizadoAt && <Badge variant="secondary">Check-out concluído</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tutor: {p.pet?.cliente?.nome || 'Não informado'} · {p.servico}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Atendimento em {new Date(p.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {p.status === 'cancelado' ? ' · Cancelado (histórico)' : ''}
                  </p>
                </div>
                {(p.requiresFicha || p.ficha) && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelecionado(p)}>
                    <ClipboardList className="mr-1 size-4" /> Abrir ficha / Imprimir
                  </Button>
                )}
              </div>
              {legado && p.anamnese && (
                <details className="mt-3 rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Consultar anamnese anterior</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{p.anamnese}</p>
                </details>
              )}
            </article>
          )
        })}
      </div>
      <AtendimentoFichaDialog
        processo={selecionado}
        onClose={() => { setSelecionado(null); void carregar() }}
      />
    </div>
  )
}
