'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { portalRequest } from '@/components/cliente-portal/ExperienceProvider'
import type { Booking } from '@/components/cliente-portal/BookingRequests'
import { toast } from 'sonner'

type Config = {
  active: boolean
  spendCentsPerPoint: number
  rewardPoints: number
  rewardCents: number
}
type Data = {
  config: Config | null
  bookings: Booking[]
  reviews: {
    id: string
    rating: number
    comment: string
    hidden: boolean
    produto: { nome: string }
    cliente: { nome: string }
  }[]
  saved: number
  restock: number
}
const DEFAULT_CONFIG = {
  active: false,
  spendCentsPerPoint: 100,
  rewardPoints: 100,
  rewardCents: 1000,
}

function BookingDecision({
  booking,
  onSaved,
}: {
  booking: Booking
  onSaved: () => void
}) {
  const [date, setDate] = useState('')
  const [reference, setReference] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  async function respond(status: 'confirmado' | 'recusado') {
    if (status === 'confirmado' && (!date || !reference.trim())) {
      toast.error('Informe horário e referência da agenda oficial.')
      return
    }
    if (reply.trim().length < 3) {
      toast.error('Escreva uma resposta para o cliente.')
      return
    }
    setBusy(true)
    try {
      await portalRequest('/api/admin/relacionamento', {
        method: 'POST',
        body: JSON.stringify({
          action: 'booking',
          id: booking.id,
          status,
          ...(status === 'confirmado'
            ? {
                confirmedAt: new Date(date + ':00-03:00').toISOString(),
                confirmationRef: reference,
              }
            : {}),
          reply,
        }),
      })
      toast.success('Resposta salva no portal do cliente')
      onSaved()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">
        {booking.petName} · {booking.service}
      </h3>
      <p className="text-sm text-muted-foreground">
        {booking.cliente?.nome} · Preferência:{' '}
        {new Date(booking.desiredAt).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })}
      </p>
      {booking.status === 'confirmado' ? (
        <p className="text-sm text-green-700">
          Confirmado ·{' '}
          {booking.confirmedAt &&
            new Date(booking.confirmedAt).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}{' '}
          · Referência: {booking.confirmationRef}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Confira a disponibilidade e registre na agenda oficial antes de
            confirmar aqui. Esta tela não grava no ERP.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={'confirm-date-' + booking.id} className="text-sm">
                Horário confirmado (Brasília)
              </label>
              <Input
                id={'confirm-date-' + booking.id}
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={'confirm-ref-' + booking.id} className="text-sm">
                Referência na agenda oficial
              </label>
              <Input
                id={'confirm-ref-' + booking.id}
                maxLength={150}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor={'reply-' + booking.id} className="text-sm">
            Resposta ao cliente
          </label>
          <Textarea
            id={'reply-' + booking.id}
            maxLength={1000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => respond('confirmado')}>
              Confirmar horário
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => respond('recusado')}
            >
              Informar indisponibilidade
            </Button>
          </div>
        </>
      )}
    </article>
  )
}

export function CustomerExperienceAdmin() {
  const [data, setData] = useState<Data | null>(null)
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(
    () =>
      portalRequest<Data>('/api/admin/relacionamento')
        .then((payload) => {
          setData(payload)
        setConfig(payload.config ? {
          active: payload.config.active,
          spendCentsPerPoint: payload.config.spendCentsPerPoint,
          rewardPoints: payload.config.rewardPoints,
          rewardCents: payload.config.rewardCents,
        } : DEFAULT_CONFIG)
          setError('')
        })
        .catch((err) => setError((err as Error).message)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  async function save(payload: unknown) {
    setBusy(true)
    try {
      await portalRequest('/api/admin/relacionamento', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast.success('Alterações salvas')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (error)
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <h1 className="text-xl font-bold">Relacionamento com clientes</h1>
          <p>{error}</p>
          <p className="text-sm text-muted-foreground">
            Se este é o primeiro acesso após a atualização, aplique a migração
            20260928010000_customer_experience no banco do Hub. Não use o banco
            somente leitura do ERP.
          </p>
          <Button onClick={load}>Tentar novamente</Button>
        </CardContent>
      </Card>
    )
  if (!data) return <p role="status">Carregando relacionamento...</p>
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relacionamento com clientes</h1>
        <p className="text-sm text-muted-foreground">
          {data.saved} produtos favoritados · {data.restock} avisos de reposição
          ativos
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-bold">Programa de fidelidade</h2>
          <p className="text-sm text-muted-foreground">
            Defina a política da loja antes de ativar. As sugestões abaixo só
            valem após salvar. A taxa de acúmulo fica fixa para preservar o
            histórico. Pausar desativa resgates, mas mantém o acúmulo e os
            cupons já emitidos.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void save({ action: 'config', ...config })
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.active}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, active: e.target.checked }))
                }
              />
              Ativar resgates do Clube Matilha
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="loyalty-spend" className="text-sm">
                  Valor em R$ para ganhar 1 ponto
                </label>
                <Input
                  id="loyalty-spend"
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  required
                  disabled={!!data.config}
                  value={config.spendCentsPerPoint / 100}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      spendCentsPerPoint: Math.round(
                        Number(e.target.value) * 100,
                      ),
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="loyalty-points" className="text-sm">
                  Pontos por resgate
                </label>
                <Input
                  id="loyalty-points"
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  value={config.rewardPoints}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      rewardPoints: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="loyalty-value" className="text-sm">
                  Desconto por resgate (R$)
                </label>
                <Input
                  id="loyalty-value"
                  type="number"
                  step="0.01"
                  min="1"
                  max="1000"
                  required
                  value={config.rewardCents / 100}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      rewardCents: Math.round(Number(e.target.value) * 100),
                    }))
                  }
                />
              </div>
            </div>
            <Button disabled={busy}>Salvar política</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-bold">Solicitações de agendamento</h2>
          <p className="text-sm text-muted-foreground">
            As respostas aparecem no portal do cliente. Sem envio automático por
            WhatsApp ou e-mail.
          </p>
          {!data.bookings.length && (
            <p className="text-sm">Nenhuma solicitação pendente.</p>
          )}
          {data.bookings.map((booking) => (
            <BookingDecision
              key={booking.id}
              booking={booking}
              onSaved={load}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-bold">Avaliações verificadas</h2>
          <p className="text-sm text-muted-foreground">
            Oculte spam, dados pessoais ou conteúdo ofensivo. Preserve
            avaliações legítimas, inclusive críticas.
          </p>
          {!data.reviews.length && (
            <p className="text-sm">Nenhuma avaliação recebida.</p>
          )}
          {data.reviews.map((review) => (
            <article key={review.id} className="rounded-xl border p-4">
              <p className="font-semibold">
                {review.produto.nome} · {review.rating}/5
              </p>
              <p className="text-xs text-muted-foreground">
                {review.cliente.nome} · {review.hidden ? 'Oculta' : 'Visível'}
              </p>
              <p className="my-3 break-words text-sm">{review.comment}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  save({
                    action: 'review',
                    id: review.id,
                    hidden: !review.hidden,
                  })
                }
              >
                {review.hidden ? 'Reexibir avaliação' : 'Ocultar avaliação'}
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
