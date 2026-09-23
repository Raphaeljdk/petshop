'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clock, MessageCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  const [erro, setErro] = useState(false)
  const [dataPreferida, setDataPreferida] = useState<Date>()
  const [periodo, setPeriodo] = useState('Sem preferência')
  const [petNome, setPetNome] = useState('')
  const [servico, setServico] = useState('')
  const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

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
    ['Olá! Vim pelo portal da Matilha Prado e gostaria de consultar as datas e horários disponíveis.',
      petNome.trim() ? `Pet: ${petNome.trim()}.` : '',
      servico.trim() ? `Serviço: ${servico.trim()}.` : '',
      dataPreferida ? `Data de preferência: ${format(dataPreferida, 'dd/MM/yyyy')}. Período: ${periodo}.` : '',
      'Vocês têm disponibilidade? Se não, podem me informar as próximas datas livres? Aguardo a confirmação do agendamento.',
    ].filter(Boolean).join('\n')
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
            Acompanhe seus atendimentos e solicite uma nova data.
          </p>
        </div>
        <Button asChild className="btn-brand">
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            Solicitar agendamento
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-6 p-4 sm:p-6 md:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Quando você prefere vir?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha uma data para consultar. A disponibilidade e o horário serão confirmados pela equipe no WhatsApp.</p>
            <Calendar mode="single" locale={ptBR} selected={dataPreferida} onSelect={setDataPreferida} disabled={(day) => format(day, 'yyyy-MM-dd') < hojeSP} className="mx-auto mt-4 max-w-full p-0 [--cell-size:clamp(2rem,9vw,2.75rem)]" />
          </div>
          <div className="min-w-0 space-y-4">
            <div className="space-y-2"><Label htmlFor="agenda-pet">Nome do pet</Label><Input id="agenda-pet" value={petNome} maxLength={80} onChange={(e) => setPetNome(e.target.value)} placeholder="Como seu pet se chama?" className="h-11 text-base" /></div>
            <div className="space-y-2"><Label htmlFor="agenda-servico">Atendimento desejado</Label><Input id="agenda-servico" value={servico} maxLength={120} onChange={(e) => setServico(e.target.value)} placeholder="Ex.: banho e tosa" className="h-11 text-base" /></div>
            <fieldset><legend className="mb-2 text-sm font-medium">Período de preferência</legend><div className="flex flex-wrap gap-2">{['Manhã', 'Tarde', 'Sem preferência'].map((opcao) => <Button key={opcao} type="button" variant={periodo === opcao ? 'default' : 'outline'} aria-pressed={periodo === opcao} className="min-h-11" onClick={() => setPeriodo(opcao)}>{opcao}</Button>)}</div></fieldset>
            <p aria-live="polite" className="rounded-xl bg-primary/5 p-3 text-sm">{dataPreferida ? `Data solicitada: ${format(dataPreferida, 'dd/MM/yyyy')} · ${periodo}` : 'Selecione uma data no calendário.'}</p>
            <Button asChild className="btn-brand min-h-12 h-auto w-full whitespace-normal py-3"><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="size-4 shrink-0" /> Consultar disponibilidade no WhatsApp</a></Button>
            <p className="text-xs text-muted-foreground">A seleção de uma data não reserva um horário.</p>
          </div>
        </CardContent>
      </Card>

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
