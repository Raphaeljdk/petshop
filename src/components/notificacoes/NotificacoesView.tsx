'use client'

import { useEffect, useState } from 'react'
import { Bell, MessageSquare, Mail, Smartphone, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Notificacao } from '@/lib/types'

const iconByTipo: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: Smartphone,
  whatsapp: MessageSquare,
  email: Mail,
  push: Bell,
}

export function NotificacoesView() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('todos')

  const carregar = async () => {
    try {
      const res = await fetch('/api/notificacoes', { credentials: 'same-origin' })
      if (res.ok) setNotificacoes(await res.json())
    } catch (e) {
      console.error('notificacoes erro:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas =
    filtro === 'todos'
      ? notificacoes
      : notificacoes.filter((n) => n.tipo === filtro)

  const stats = {
    sms: notificacoes.filter((n) => n.tipo === 'sms').length,
    email: notificacoes.filter((n) => n.tipo === 'email').length,
    whatsapp: notificacoes.filter((n) => n.tipo === 'whatsapp').length,
    pendentes: notificacoes.filter((n) => n.status === 'pendente').length,
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Notificações</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Histórico de SMS, e-mail e WhatsApp enviados
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 sm:size-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Smartphone className="size-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.sms}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">SMS enviados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 sm:size-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Mail className="size-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.email}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">E-mails enviados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 sm:size-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <MessageSquare className="size-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.whatsapp}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">WhatsApp</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 sm:size-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Bell className="size-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.pendentes}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto custom-scrollbar -mx-1 px-1 pb-1">
        {['todos', 'sms', 'email', 'whatsapp', 'push'].map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap min-h-[36px] ${
              filtro === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/70'
            }`}
          >
            {t === 'todos' ? 'Todos' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && (
        <SkeletonLoader type="list" count={5} />
      )}

      {/* Tabela desktop */}
      {!loading && (
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma notificação.
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map((n) => {
                const Icon = iconByTipo[n.tipo] || Bell
                return (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-xs uppercase font-medium">{n.tipo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{n.destino}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate">{n.mensagem}</p>
                      {n.processo?.pet?.nome && (
                        <p className="text-xs text-muted-foreground">
                          Pet: {n.processo.pet.nome}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          n.status === 'enviada' || n.status === 'success'
                            ? 'default'
                            : n.status === 'pendente'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {n.status === 'enviada' || n.status === 'success' ? (
                          <>
                            <Check className="size-3" /> Enviada
                          </>
                        ) : (
                          n.status
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(n.createdAt), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Cards mobile */}
      {!loading && (
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filtradas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma notificação.
          </p>
        )}
        {filtradas.map((n) => {
          const Icon = iconByTipo[n.tipo] || Bell
          return (
            <Card key={n.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs uppercase font-medium block">{n.tipo}</span>
                      <span className="text-xs font-mono text-muted-foreground block truncate">{n.destino}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      n.status === 'enviada' || n.status === 'success'
                        ? 'default'
                        : n.status === 'pendente'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="text-[10px] shrink-0"
                  >
                    {n.status === 'enviada' || n.status === 'success' ? (
                      <>
                        <Check className="size-3" /> Enviada
                      </>
                    ) : (
                      n.status
                    )}
                  </Badge>
                </div>
                <p className="text-sm">{n.mensagem}</p>
                {n.processo?.pet?.nome && (
                  <p className="text-xs text-muted-foreground">
                    Pet: {n.processo.pet.nome}
                  </p>
                )}
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  {format(parseISO(n.createdAt), 'dd/MM/yyyy HH:mm')}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}
    </div>
  )
}
