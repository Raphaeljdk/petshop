'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Mail, Phone, MessageSquare, ChevronRight } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRealtime } from '@/hooks/use-realtime'
import type { Notificacao } from '@/lib/types'

interface NotificationBellProps {
  onVerTodas?: () => void
}

// Ícone por tipo de notificação (sms -> Phone, email -> Mail, whatsapp -> MessageSquare, push -> Bell)
const iconByTipo: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  push: Bell,
}

const labelByTipo: Record<string, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  push: 'Push',
}

function tempoRelativo(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: ptBR, addSuffix: true })
  } catch {
    return '—'
  }
}

function truncar(texto: string, max = 80): string {
  if (!texto) return ''
  return texto.length > max ? texto.slice(0, max).trimEnd() + '…' : texto
}

export function NotificationBell({ onVerTodas }: NotificationBellProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificacoes', { credentials: 'same-origin' })
      if (res.ok) {
        const data: Notificacao[] = await res.json()
        // Últimas 24h
        const limite = Date.now() - 24 * 60 * 60 * 1000
        const recentes = data.filter((n) => {
          try {
            return new Date(n.createdAt).getTime() >= limite
          } catch {
            return false
          }
        })
        setNotificacoes(recentes)
      }
    } catch (e) {
      console.error('notification bell erro:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
  }, [carregar])

  // Atualiza em tempo real quando chegar nova notificação via WebSocket
  const handleRealtime = useCallback(
    (_data: any) => {
      carregar()
    },
    [carregar]
  )

  useRealtime([{ event: 'notificacao:nova', handler: handleRealtime }])

  // Últimas 10 para o popover
  const ultimas10 = notificacoes.slice(0, 10)
  const count = notificacoes.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 shrink-0"
          aria-label={`Notificações${count > 0 ? ` (${count} novas)` : ''}`}
        >
          <Bell className="size-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] flex items-center justify-center rounded-full"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-96 max-w-[400px] p-0"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <p className="text-sm font-semibold">Notificações recentes</p>
          </div>
          <span className="text-xs text-muted-foreground">últimas 24h</span>
        </div>

        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : ultimas10.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação nas últimas 24h.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ultimas10.map((n) => {
                const Icon = iconByTipo[n.tipo] || Bell
                const label = labelByTipo[n.tipo] || n.tipo
                return (
                  <li
                    key={n.id}
                    className="px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-default"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            {label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {tempoRelativo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {n.destino}
                        </p>
                        <p className="text-sm text-foreground mt-0.5">
                          {truncar(n.mensagem, 80)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => {
              setOpen(false)
              onVerTodas?.()
            }}
          >
            Ver todas as notificações
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
