'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { portalRequest } from './ExperienceProvider'
import { toast } from 'sonner'

export type Booking = {
  id: string; petName: string; service: string; desiredAt: string; status: string
  confirmedAt: string | null; confirmationRef: string | null; reply: string | null
  cliente?: { nome: string }
}

type Disponibilidade = {
  enabled: boolean
  services: Array<{ chave: string; nome: string; duracaoMinutos: number }>
  professionals: Array<{ id: string; nome: string; especialidades: string | null }>
  slots: Array<{ inicio: string; hora: string }>
}

const vazia: Disponibilidade = { enabled: false, services: [], professionals: [], slots: [] }
const dataLabel = (valor: string) => new Date(valor).toLocaleString('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
})
const dataLocal = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date)

export function BookingRequests({ onBooked }: { onBooked?: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pets, setPets] = useState<Array<{ id: string; nome: string }>>([])
  const [agenda, setAgenda] = useState<Disponibilidade>(vazia)
  const [slots, setSlots] = useState<Disponibilidade['slots']>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState('')
  const [petId, setPetId] = useState('')
  const [servicoChave, setServicoChave] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [dia, setDia] = useState('')
  const [slot, setSlot] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const [meta, animais, antigas] = await Promise.all([
      portalRequest<Disponibilidade>('/api/cliente/agendamentos/horarios'),
      portalRequest<Array<{ id: string; nome: string }>>('/api/cliente/pets'),
      portalRequest<Booking[]>('/api/cliente/solicitacoes-agendamento'),
    ])
    setAgenda(meta)
    setPets(animais)
    setBookings(antigas)
    setServicoChave((value) => value || meta.services[0]?.chave || '')
    setProfissionalId((value) => value || meta.professionals[0]?.id || '')
    setReady(true)
    setErro('')
  }, [])

  useEffect(() => {
    void load().catch((reason) => {
      setErro(reason instanceof Error ? reason.message : 'Não foi possível consultar a agenda.')
      setReady(true)
    })
  }, [load])

  useEffect(() => {
    let live = true
    setSlots([])
    setSlot('')
    if (!agenda.enabled || !dia || !servicoChave || !profissionalId) return
    setConsultando(true)
    const url = '/api/cliente/agendamentos/horarios?' + new URLSearchParams({
      data: dia, servico: servicoChave, profissionalId,
    })
    portalRequest<Disponibilidade>(url)
      .then((data) => { if (live) { setSlots(data.slots); setErro('') } })
      .catch((reason) => { if (live) setErro(reason instanceof Error ? reason.message : 'Falha ao consultar horários.') })
      .finally(() => { if (live) setConsultando(false) })
    return () => { live = false }
  }, [agenda.enabled, dia, servicoChave, profissionalId])

  async function reservar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slot || !agenda.enabled) return
    setBusy(true)
    try {
      await portalRequest('/api/cliente/agendamentos', {
        method: 'POST',
        body: JSON.stringify({ petId, servicoChave, profissionalId, dataHora: slot, observacoes: notes }),
      })
      toast.success('Agendamento realizado! Confira sua reserva em Próximos.')
      setSlot('')
      setDia('')
      setNotes('')
      setSlots([])
      onBooked?.()
      void load().catch(() => {})
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Não foi possível concluir a reserva.')
      setSlot('')
      // Reconsulta o mesmo dia após um conflito de disponibilidade.
      const atual = dia
      setDia('')
      window.setTimeout(() => setDia(atual), 0)
    } finally { setBusy(false) }
  }

  const hoje = dataLocal(new Date())
  const limite = dataLocal(new Date(Date.now() + 90 * 86400_000))

  return (
    <Card id="agendamento-online">
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarCheck2 className="size-5 text-primary" />Agendar pelo site
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha seu pet, serviço, profissional e um horário disponível. A reserva será registrada diretamente na agenda da Matilha Prado.
          </p>
        </div>

        {!ready && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />Consultando horários disponíveis...
        </p>}
        {erro && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{erro}</p>}
        {ready && !agenda.enabled && (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            A agenda online ainda não foi ativada pela equipe. Os horários serão liberados após a configuração do expediente.
          </p>
        )}
        {ready && agenda.enabled && !agenda.services.length && (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            Aguardando a confirmação dos serviços e de suas durações pela equipe.
          </p>
        )}
        {ready && agenda.enabled && !agenda.professionals.length && (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            Nenhum profissional está disponível para reservas online.
          </p>
        )}
        {ready && agenda.enabled && !!agenda.services.length && !!agenda.professionals.length && (
          <form onSubmit={(event) => void reservar(event)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="reserva-pet" className="text-sm font-medium">Pet *</label>
              <select id="reserva-pet" required value={petId} onChange={(e) => setPetId(e.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm" disabled={busy}>
                <option value="">Selecione seu pet</option>
                {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="reserva-servico" className="text-sm font-medium">Serviço *</label>
              <select id="reserva-servico" required value={servicoChave}
                onChange={(e) => setServicoChave(e.target.value)} disabled={busy}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                {agenda.services.map((servico) => <option key={servico.chave} value={servico.chave}>{servico.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="reserva-profissional" className="text-sm font-medium">Profissional *</label>
              <select id="reserva-profissional" value={profissionalId} required
                onChange={(e) => setProfissionalId(e.target.value)} disabled={busy}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                {agenda.professionals.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="reserva-dia" className="text-sm font-medium">Data (Brasília) *</label>
              <Input id="reserva-dia" type="date" required min={hoje} max={limite}
                value={dia} onChange={(e) => setDia(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium">Horários disponíveis *</span>
              {consultando ? <p role="status" className="text-xs text-muted-foreground">Consultando disponibilidade...</p> :
                !dia ? <p className="text-xs text-muted-foreground">Escolha uma data para ver os horários.</p> :
                  !slots.length ? <p className="text-xs text-muted-foreground">
                    Sem horários disponíveis nesta data. Escolha outro dia ou profissional.
                  </p> : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((item) => (
                        <Button key={item.inicio} type="button" size="sm" disabled={busy}
                          variant={slot === item.inicio ? 'default' : 'outline'}
                          aria-pressed={slot === item.inicio}
                          onClick={() => setSlot(item.inicio)}>{item.hora}</Button>
                      ))}
                    </div>
                  )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="reserva-obs" className="text-sm font-medium">Observações</label>
              <Textarea id="reserva-obs" maxLength={1000} value={notes} disabled={busy}
                placeholder="Preferências ou cuidados especiais do seu pet"
                onChange={(e) => setNotes(e.target.value)} />
            </div>
            {!pets.length && <p className="text-xs text-muted-foreground sm:col-span-2">
              Cadastre um pet em Meus Pets antes de fazer a reserva.
            </p>}
            <Button type="submit" className="sm:col-span-2" disabled={busy || consultando || !petId || !slot}>
              {busy ? 'Confirmando...' : 'Confirmar agendamento no site'}
            </Button>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Somente horários livres são exibidos. Agendamentos podem ser cancelados pelo portal com mais de 24 horas de antecedência.
            </p>
          </form>
        )}

        {!!bookings.length && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Solicitações antigas</h3>
            {bookings.map((b) => <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
              <div><strong>{b.petName} · {b.service}</strong>
                <p className="mt-1 text-muted-foreground">{dataLabel(b.desiredAt)} · {b.status === 'solicitado' ? 'Aguardando resposta da equipe' : b.status}</p>
                {b.reply && <p className="mt-1">Resposta da loja: {b.reply}</p>}
              </div>
              {b.status === 'solicitado' && <Button type="button" size="sm" variant="outline" disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await portalRequest('/api/cliente/solicitacoes-agendamento?id=' + encodeURIComponent(b.id), { method: 'DELETE' })
                    await load()
                  } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao cancelar solicitação.') }
                  finally { setBusy(false) }
                }}>Cancelar solicitação</Button>}
            </div>)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
