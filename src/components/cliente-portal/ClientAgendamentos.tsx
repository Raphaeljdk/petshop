'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Clock, MessageCircle, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import type { Agendamento } from '@/lib/types'
import { BookingRequests } from './BookingRequests'
import { MinhasComandas } from '@/components/atendimentos/ComandaAtendimento'

const statusVariant = (status: string) => {
  if (status === 'concluido') return 'bg-green-100 text-green-700'
  if (status === 'confirmado') return 'bg-amber-100 text-amber-700'
  if (status === 'cancelado') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-700'
}

export function ClientAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const formularioRef=useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/cliente/agendamentos', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'Falha ao consultar agendamentos')
        }
        return response.json()
      })
      .then((payload) => {
        if (active) setAgendamentos(Array.isArray(payload) ? payload : [])
      })
      .catch((error) => { console.error('cliente/agendamentos erro:', error); if (active) setErro(true) })
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [refresh])

  const futuros = useMemo(
    () =>
      agendamentos
        .filter((item) => new Date(item.dataHora).getTime() >= Date.now() - 60_000)
        .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()),
    [agendamentos]
  )

  const historico = useMemo(
    () =>
      agendamentos
        .filter((item) => new Date(item.dataHora).getTime() < Date.now() - 60_000)
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()),
    [agendamentos]
  )

  const whatsapp=matilhaWhatsAppUrl('Olá! Vim pelo portal da Matilha Prado e preciso de ajuda com o agendamento do meu pet.')

  async function cancelarAgendamento(item: Agendamento) {
    if (!window.confirm('Cancelar sua reserva para ' + (item.pet?.nome || 'seu pet') + '?')) return
    try {
      const res = await fetch('/api/cliente/agendamentos/' + item.id, { method: 'DELETE', credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível cancelar.')
      toast.success('Agendamento cancelado com sucesso.')
      setRefresh(v => v + 1)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao cancelar.') }
  }

  const card = (item: Agendamento, passado = false) => {
    const data = parseISO(item.dataHora)
    return (
      <Card key={item.id} className={passado ? 'opacity-75' : 'card-hover'}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-xs font-bold">{format(data, 'dd')}</span>
            <span className="text-[10px] uppercase">{format(data, 'MMM', { locale: ptBR })}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="size-3.5" /> {format(data, 'HH:mm')}
            </p>
            <p className="truncate text-sm font-medium">{item.servico}</p>
            <p className="truncate text-xs text-muted-foreground">{item.pet?.nome || 'Pet'}</p>
          </div>
          {!passado && item.status === 'agendado' && new Date(item.dataHora).getTime() > Date.now() + 24 * 60 * 60_000 && (
            <Button variant="outline" size="sm" type="button" onClick={() => void cancelarAgendamento(item)} className="text-xs text-destructive">Cancelar</Button>
          )}
          <Badge className={`text-[10px] ${statusVariant(item.status)}`}>
            {item.statusOriginal || item.status}
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus atendimentos e agende uma nova data.
          </p>
        </div>
        <Button type="button" className="btn-brand" onClick={()=>{if(formularioRef.current){formularioRef.current.open=true;formularioRef.current.scrollIntoView({behavior:'smooth',block:'start'})}}}>
          <Plus className="size-4"/> Novo agendamento
        </Button>
      </div>

      <MinhasComandas />
      <details ref={formularioRef} className="rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold">Novo agendamento</summary>
        <div className="mt-3"><BookingRequests onBooked={()=>setRefresh(v=>v+1)}/></div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
        <span className="text-sm text-muted-foreground">Precisa de ajuda com o agendamento?</span>
        <Button asChild size="sm" variant="outline"><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4"/> Consultar pelo WhatsApp</a></Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximos</h2>
        {loading ? (
          <SkeletonLoader type="list" count={4} />
        ) : erro ? (
          <Card><CardContent className="p-6 text-sm">Não foi possível carregar seus atendimentos. Atualize a página ou fale com a equipe pelo WhatsApp.</CardContent></Card>
        ) : futuros.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarClock className="mx-auto mb-3 size-9 text-muted-foreground/40" />
              <p className="font-medium">Nenhum atendimento futuro</p>
              <p className="mt-1 text-sm text-muted-foreground">Use o botão acima para agendar um novo atendimento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{futuros.map((item) => card(item))}</div>
        )}
      </section>

      {historico.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Histórico</h2>
          <div className="grid gap-3 md:grid-cols-2">{historico.map((item) => card(item, true))}</div>
        </section>
      )}
    </div>
  )
}
