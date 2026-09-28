'use client'

import { useEffect, useState } from 'react'
import { Bell, Gift, Heart, CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  portalRequest,
  useExperience,
  type Preference,
} from './ExperienceProvider'
import { toast } from 'sonner'

type Loyalty = {
  config: {
    active: boolean
    spendCentsPerPoint: number
    rewardPoints: number
    rewardCents: number
  } | null
  earned: number
  used: number
  balance: number
  redemptions: { id: string; couponCode: string; points: number }[]
}
const money = (n: number) =>
  (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function calendarReminder(preference: Preference) {
  if (!preference.reminderAt) return
  const stamp = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Matilha Prado//Reposicao//PT',
    'BEGIN:VEVENT',
    `UID:${preference.id}@matilhaprado.com.br`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(preference.reminderAt)}`,
    `SUMMARY:${escape('Repor ' + preference.product.nome)}`,
    'DESCRIPTION:Confira a disponibilidade na Matilha Prado.',
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de reposição',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(
    new Blob([body], { type: 'text/calendar;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'lembrete-matilha.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CustomerClub({ onShop }: { onShop: () => void }) {
  const { preferences, loading, ready, update, busy } = useExperience()
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  useEffect(() => {
    portalRequest<Loyalty>('/api/cliente/fidelidade')
      .then(setLoyalty)
      .catch(() => {})
  }, [])
  if (loading)
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Carregando seus favoritos e lembretes...
      </p>
    )
  if (!ready)
    return (
      <Card className="mt-6">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Favoritos e benefícios estão em preparação. Suas compras e os demais
          serviços continuam disponíveis.
        </CardContent>
      </Card>
    )
  const favorites = preferences.filter((p) => p.favorite)
  const reminders = preferences.filter((p) => p.reminderAt)
  const restock = preferences.filter((p) => p.restock)
  return (
    <section className="mt-8 space-y-5" aria-labelledby="club-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Feito para sua matilha
        </p>
        <h2 id="club-title" className="mt-1 text-2xl font-bold">
          Meus favoritos e lembretes
        </h2>
        <p className="text-sm text-muted-foreground">
          Salvos na sua conta. Avisos de reposição e estoque aparecem aqui ao
          acessar o portal.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [Heart, 'Favoritos', favorites.length],
          [CalendarClock, 'Lembretes', reminders.length],
          [Bell, 'Avisos de estoque', restock.length],
        ].map(([Icon, label, count]) => {
          const I = Icon as typeof Heart
          return (
            <Card key={String(label)}>
              <CardContent className="flex items-center gap-3 p-5">
                <I className="size-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{String(count)}</p>
                  <p className="text-sm text-muted-foreground">
                    {String(label)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {preferences.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p>Toque no coração dos produtos para salvar seus favoritos.</p>
            <Button className="mt-3" onClick={onShop}>
              Explorar a loja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {preferences.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <h3 className="font-semibold">{p.product.nome}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.favorite && (
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                      Favorito
                    </span>
                  )}
                  {p.restock && (
                    <span className="rounded-full bg-primary/10 px-3 py-1">
                      {p.available === true
                        ? 'Voltou ao estoque! Confira na loja.'
                        : p.available === null
                          ? 'Estoque não confirmado no momento'
                          : 'Aguardando reposição'}
                    </span>
                  )}
                </div>
                {p.reminderAt && (
                  <div className="rounded-xl bg-muted p-3 text-sm">
                    <p>
                      {new Date(p.reminderAt) <= new Date()
                        ? 'Hora de conferir a reposição'
                        : 'Próximo lembrete'}{' '}
                      ·{' '}
                      {new Date(p.reminderAt).toLocaleDateString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => calendarReminder(p)}
                    >
                      Adicionar ao calendário
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={onShop}>
                    Ver na loja
                  </Button>
                  {p.favorite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        update({ produtoId: p.produtoId, favorite: false })
                      }
                    >
                      Remover favorito
                    </Button>
                  )}
                  {p.restock && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        update({ produtoId: p.produtoId, restock: false })
                      }
                    >
                      Cancelar aviso
                    </Button>
                  )}
                  {p.reminderAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        update({ produtoId: p.produtoId, reminderAt: null })
                      }
                    >
                      Concluir lembrete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {loyalty?.config && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Gift className="size-5 text-primary" />
              <h3 className="text-xl font-bold">Clube Matilha</h3>
            </div>
            <p className="text-3xl font-bold">
              {loyalty.balance}{' '}
              <span className="text-sm font-normal">pontos disponíveis</span>
            </p>
            <p className="text-sm text-muted-foreground">
              1 ponto a cada {money(loyalty.config.spendCentsPerPoint)} em
              compras concluídas após o início do programa, sem frete. Serviços
              contam quando lançados em uma venda concluída. Cancelamentos e
              estornos retiram os pontos correspondentes.
            </p>
            <p className="text-sm">
              Troque {loyalty.config.rewardPoints} pontos por{' '}
              {money(loyalty.config.rewardCents)} de desconto. Cupom pessoal,
              válido por 90 dias, para compras de pelo menos{' '}
              {money(loyalty.config.rewardCents + 100)} em produtos.
            </p>
            <Button
              disabled={
                !loyalty.config.active ||
                loyalty.balance < loyalty.config.rewardPoints ||
                redeeming
              }
              onClick={async () => {
                setRedeeming(true)
                try {
                  await portalRequest('/api/cliente/fidelidade', {
                    method: 'POST',
                  })
                  setLoyalty(
                    await portalRequest<Loyalty>('/api/cliente/fidelidade'),
                  )
                  toast.success(
                    'Benefício resgatado! Use seu cupom no carrinho.',
                  )
                } catch (error) {
                  toast.error((error as Error).message)
                } finally {
                  setRedeeming(false)
                }
              }}
            >
              {!loyalty.config.active
                ? 'Resgates temporariamente pausados'
                : redeeming
                  ? 'Resgatando...'
                  : 'Resgatar benefício'}
            </Button>
            {loyalty.redemptions.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  Seu cupom · {r.points} pontos resgatados
                </p>
                <code className="break-all font-bold">{r.couponCode}</code>
                <p className="text-xs text-muted-foreground">
                  A validade e o uso serão conferidos ao aplicar no carrinho.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
