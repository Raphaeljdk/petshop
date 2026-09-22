'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clock, MessageCircle, ShieldCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import type { Agendamento } from '@/lib/types'

const statusVariant = (status: string) => {
  if (status === 'concluido') return 'bg-green-100 text-green-700'
  if (status === 'confirmado') return 'bg-amber-100 text-amber-700'
  if (status === 'cancelado') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-700'
}

export function ClientAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)

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
      .catch((error) => console.error('cliente/agendamentos erro:', error))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [])

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

  const whatsapp = matilhaWhatsAppUrl(
    'Olá! Vim pelo portal da Matilha Prado e gostaria de agendar um atendimento para o meu pet.'
  )

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
            Seus atendimentos são sincronizados diretamente com o Siggma.
          </p>
        </div>
        <Button asChild className="btn-brand">
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            Solicitar agendamento
          </a>
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Agenda oficial da Matilha Prado</p>
            <p className="mt-1 text-muted-foreground">
              O portal já exibe os registros do Siggma. A criação de novos horários pelo próprio Hub aguarda a liberação de uma API oficial de agendamento pela Zetta.
            </p>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximos</h2>
        {loading ? (
          <SkeletonLoader type="list" count={4} />
        ) : futuros.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarClock className="mx-auto mb-3 size-9 text-muted-foreground/40" />
              <p className="font-medium">Nenhum atendimento futuro</p>
              <p className="mt-1 text-sm text-muted-foreground">Use o botão acima para falar com a Matilha Prado.</p>
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
