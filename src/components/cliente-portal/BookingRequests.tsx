'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck2, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { portalRequest } from './ExperienceProvider'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
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

type CatalogoDisponivel = { motivo: string | null; servicos: Array<{ chave: string; nome: string; precoCentavos: number; duracaoMinutos: number }> }

type DirectBookingConfig = {
  configured: boolean
  writeConfigured: boolean
  services: Array<{ id: number; nome: string }>
  fallback: string | null
  catalogo?: CatalogoDisponivel
}

const dateLabel = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

export function BookingRequests() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [historicoServicos, setHistoricoServicos] = useState<Array<{ petId: string; servico: string; status: string; dataHora: string }>>([])
  const [pets, setPets] = useState<{ id: string; nome: string }[]>([])
  const [direct, setDirect] = useState<DirectBookingConfig>({
    configured: false,
    writeConfigured: false,
    services: [],
    fallback: 'solicitacao-equipe',
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [petKey, setPetKey] = useState('')
  const [service, setService] = useState('')
  const [catalogo, setCatalogo] = useState<CatalogoDisponivel | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [erroCatalogo, setErroCatalogo] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [desired, setDesired] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(
    () =>
      Promise.all([
        portalRequest<Booking[]>('/api/cliente/solicitacoes-agendamento'),
        portalRequest<{ id: string; nome: string }[]>('/api/cliente/pets'),
        portalRequest<DirectBookingConfig>('/api/cliente/agendamentos/servicos'),
        portalRequest<Array<{ petId: string; servico: string; status: string; dataHora: string }>>('/api/cliente/agendamentos').catch(() => []),
      ])
        .then(([rows, animals, bookingConfig, historico]) => {
          setHistoricoServicos(Array.isArray(historico) ? historico : [])
          setBookings(rows)
          setPets(animals)
          setDirect(bookingConfig)
          setServiceId((current) =>
            current ||
            (bookingConfig.services[0]?.id
              ? String(bookingConfig.services[0].id)
              : ''),
          )
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

  useEffect(() => {
    let cancelado = false
    setCatalogo(null); setErroCatalogo(''); setService('')
    if (!petKey || !desired) { setConsultando(false); return }
    const quando = new Date(desired + ':00-03:00')
    if (!Number.isFinite(quando.getTime()) || quando.getTime() <= Date.now()) {
      setConsultando(false); setErroCatalogo('Escolha uma data futura.'); return
    }
    setConsultando(true)
    portalRequest<DirectBookingConfig>('/api/cliente/agendamentos/servicos?petKey=' + encodeURIComponent(petKey) + '&quando=' + encodeURIComponent(quando.toISOString()))
      .then(data => { if (!cancelado) setCatalogo(data.catalogo ?? null) })
      .catch(e => { if (!cancelado) setErroCatalogo(e instanceof Error ? e.message : 'Erro na consulta.') })
      .finally(() => { if (!cancelado) setConsultando(false) })
    return () => { cancelado = true }
  }, [petKey, desired])

  if (!ready) return null

  const directMode =
    direct.configured && pets.some((pet) => pet.id.startsWith('zetta:'))

  const sugestoesRecentes = Array.from(new Set(historicoServicos
    .filter(item => item.petId === petKey && item.status === 'concluido' && item.servico.trim())
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map(item => item.servico.trim()))).slice(0, 4)

  const disponiveis = catalogo?.servicos ?? []
  const selecionado = disponiveis.find(s => s.nome === service)
  const whatsapp = matilhaWhatsAppUrl('Olá! Gostaria de consultar serviços e horários para ' + (pets.find(p => p.id === petKey)?.nome || 'meu pet') + (desired ? ' em ' + desired.replace('T', ' às ') : '') + '.')
  const preco = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {directMode ? (
              <CalendarCheck2 className="size-5 text-primary" />
            ) : (
              <CalendarClock className="size-5 text-primary" />
            )}
            {directMode ? 'Agendar direto no Siggma' : 'Solicitar pelo portal'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {directMode
              ? 'Escolha pet, serviço, data e horário. O Siggma valida o expediente antes de confirmar.'
              : 'Escolha seu pet e um horário de preferência. A solicitação só vira reserva após a confirmação da equipe.'}
          </p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              if (directMode) {
                await portalRequest('/api/cliente/agendamentos', {
                  method: 'POST',
                  body: JSON.stringify({
                    petId: petKey,
                    servicoId: Number(serviceId),
                    quando: desired,
                    observacoes: notes,
                  }),
                })
                toast.success('Agendamento confirmado pelo Siggma.')
                setDesired('')
                setNotes('')
                window.setTimeout(() => window.location.reload(), 700)
              } else {
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
              }
            } catch (error) {
              toast.error((error as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <div>
            <label htmlFor="request-pet" className="text-sm font-medium">Pet</label>
            <select
              id="request-pet"
              required
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              value={petKey}
              onChange={(e) => { setPetKey(e.target.value); setCatalogo(null); setService('') }}
            >
              <option value="">Selecione seu pet</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="request-service" className="text-sm font-medium">Serviço</label>
            {directMode ? (
              <select
                id="request-service"
                required
                className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Selecione o serviço</option>
                {direct.services.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            ) : (
              <select id="request-service" required disabled={consultando || !disponiveis.length} className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={service} onChange={e => setService(e.target.value)}>
                <option value="">{consultando ? 'Consultando...' : 'Selecione o serviço'}</option>
                {disponiveis.map(s => <option value={s.nome} key={s.chave}>{s.nome} · {preco(s.precoCentavos)} · {s.duracaoMinutos} min</option>)}
              </select>
            )}
            {!directMode && (
              <>
                {selecionado && <p className="mt-1 text-xs text-muted-foreground">Valor: {preco(selecionado.precoCentavos)} · Duração prevista: {selecionado.duracaoMinutos} min.</p>}
                {(!petKey || !desired) && <p className="mt-1 text-xs text-muted-foreground">Escolha o pet e a data para consultar os serviços.</p>}
                {erroCatalogo && <p className="mt-1 text-xs text-destructive">{erroCatalogo}</p>}
                {catalogo && !disponiveis.length && <p className="mt-1 text-xs text-muted-foreground">{catalogo.motivo === 'raca-nao-cadastrada' ? 'A raça não consta na tabela de serviços confirmados.' : 'Não encontramos serviços disponíveis neste horário.'}</p>}
                {petKey && desired && !consultando && !disponiveis.length && <Button asChild variant="outline" size="sm" className="mt-2"><a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp</a></Button>}
                {sugestoesRecentes.length > 0 && <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">Últimos serviços concluídos deste pet</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sugestoesRecentes.map(nome => <Button key={nome} type="button" size="sm" variant="outline" disabled={busy || !disponiveis.some(s => s.nome === nome)} onClick={() => setService(nome)}>{nome}</Button>)}
                  </div>
                </div>}
              </>
            )}
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
              onChange={(e) => { setDesired(e.target.value); setCatalogo(null); setService('') }}
            />
          </div>

          <div>
            <label htmlFor="request-notes" className="text-sm font-medium">Observações</label>
            <Textarea
              id="request-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={
              busy ||
              !pets.length ||
              (directMode ? (!serviceId || !petKey.startsWith('zetta:')) : (consultando || !selecionado))
            }
          >
            {busy
              ? 'Enviando...'
              : directMode
                ? 'Confirmar agendamento'
                : 'Enviar solicitação'}
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
                <h3 className="font-semibold">{b.petName} · {b.service}</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs">
                  {b.status === 'solicitado' ? 'Aguardando confirmação' : b.status}
                </span>
              </div>
              <p className="mt-2 text-sm">Preferência: {dateLabel(b.desiredAt)}</p>
              {b.confirmedAt && (
                <p className="text-sm font-semibold text-green-700">
                  Confirmado para {dateLabel(b.confirmedAt)}
                </p>
              )}
              {b.reply && (
                <p className="mt-2 break-words text-sm">Resposta da loja: {b.reply}</p>
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
