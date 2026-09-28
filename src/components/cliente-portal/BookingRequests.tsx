'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { portalRequest } from './ExperienceProvider'
import { toast } from 'sonner'

export type Booking = {
  id: string
  petName: string
  service: string
  desiredAt: string
  status: string
  confirmedAt: string | null
  confirmationRef: string | null
  reply: string | null
  cliente?: { nome: string }
}
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

export function BookingRequests() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pets, setPets] = useState<{ id: string; nome: string }[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [petKey, setPetKey] = useState('')
  const [service, setService] = useState('Banho')
  const [desired, setDesired] = useState('')
  const [notes, setNotes] = useState('')
  const load = useCallback(
    () =>
      Promise.all([
        portalRequest<Booking[]>('/api/cliente/solicitacoes-agendamento'),
        portalRequest<{ id: string; nome: string }[]>('/api/cliente/pets'),
      ])
        .then(([rows, animals]) => {
          setBookings(rows)
          setPets(animals)
          setReady(true)
        })
        .catch(() => setReady(false)),
    [],
  )
  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60000)
    return () => clearInterval(timer)
  }, [load])
  if (!ready) return null
  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="size-5 text-primary" />
            Solicitar pelo portal
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha seu pet e um horário de preferência. A solicitação só vira
            reserva após a confirmação da equipe, que aparece abaixo.
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              await portalRequest('/api/cliente/solicitacoes-agendamento', {
                method: 'POST',
                body: JSON.stringify({
                  petKey,
                  service,
                  desiredAt: new Date(desired + ':00-03:00').toISOString(),
                  notes,
                }),
              })
              toast.success(
                'Solicitação enviada. Aguarde a confirmação da equipe no portal.',
              )
              setDesired('')
              setNotes('')
              await load()
            } catch (error) {
              toast.error((error as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <label htmlFor="request-pet" className="text-sm font-medium">
              Pet
            </label>
            <select
              id="request-pet"
              required
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              value={petKey}
              onChange={(e) => setPetKey(e.target.value)}
            >
              <option value="">Selecione seu pet</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="request-service" className="text-sm font-medium">
              Serviço
            </label>
            <Input
              id="request-service"
              required
              minLength={3}
              maxLength={120}
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="request-date" className="text-sm font-medium">
              Data e horário desejados (Brasília)
            </label>
            <Input
              id="request-date"
              type="datetime-local"
              required
              value={desired}
              onChange={(e) => setDesired(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="request-notes" className="text-sm font-medium">
              Observações
            </label>
            <Textarea
              id="request-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !pets.length}>
            {busy ? 'Enviando...' : 'Enviar solicitação'}
          </Button>
        </form>
        {!pets.length && (
          <p className="text-sm text-muted-foreground">
            Cadastre seu pet ou peça à loja para vinculá-lo à sua conta.
          </p>
        )}
        <div className="space-y-3" aria-live="polite">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {b.petName} · {b.service}
                </h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs">
                  {b.status === 'solicitado'
                    ? 'Aguardando confirmação'
                    : b.status}
                </span>
              </div>
              <p className="mt-2 text-sm">
                Preferência: {dateLabel(b.desiredAt)}
              </p>
              {b.confirmedAt && (
                <p className="text-sm font-semibold text-green-700">
                  Confirmado para {dateLabel(b.confirmedAt)}
                </p>
              )}
              {b.reply && (
                <p className="mt-2 break-words text-sm">
                  Resposta da loja: {b.reply}
                </p>
              )}
              {b.status === 'solicitado' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await portalRequest(
                        '/api/cliente/solicitacoes-agendamento?id=' +
                          encodeURIComponent(b.id),
                        { method: 'DELETE' },
                      )
                      await load()
                    } catch (error) {
                      toast.error((error as Error).message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Cancelar solicitação
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
