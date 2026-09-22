'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ShoppingBag, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import type { Venda } from '@/lib/types'

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const statusVariant = (s: string) => {
  switch (s) {
    case 'concluida':
      return 'bg-green-100 text-green-700'
    case 'pendente':
      return 'bg-amber-100 text-amber-700'
    case 'cancelada':
      return 'bg-red-100 text-red-700'
    default:
      return ''
  }
}

export function ClientMinhasCompras() {
  const [compras, setCompras] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const carregar = async () => {
    try {
      const res = await fetch('/api/cliente/compras', { credentials: 'same-origin' })
      if (res.ok) setCompras(await res.json())
    } catch (e) {
      console.error('compras cliente erro:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minhas Compras</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de pedidos realizados
        </p>
      </div>

      {loading && (
        <SkeletonLoader type="list" count={4} />
      )}

      {!loading && compras.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingBag className="size-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Você ainda não fez nenhuma compra.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {compras.map((v) => (
          <Card key={v.id} className="card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Package className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      Pedido #{v.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(v.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-primary">{fmtMoeda(v.total)}</p>
                    <Badge className={`text-[10px] ${statusVariant(v.status)}`}>
                      {v.status}
                    </Badge>
                    {v.statusFiscal && v.statusFiscal !== 'EXCLUIDO' && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        Fiscal: {v.statusFiscal}
                      </Badge>
                    )}
                  </div>
                  {v.itens && v.itens.length > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                    >
                      {expanded === v.id ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {expanded === v.id && v.itens && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Itens ({v.itens.length})
                  </p>
                  {v.itens.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {it.quantidade}x
                        </Badge>
                        <span>{it.produto?.nome || `Produto ${it.produtoId.slice(-6)}`}</span>
                      </div>
                      <span className="font-medium">
                        {fmtMoeda(it.precoUnit * it.quantidade)}
                      </span>
                    </div>
                  ))}
                  {v.siggmaGuid && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground break-all">
                        <strong>GUID Siggma:</strong> {v.siggmaGuid}
                      </p>
                    </div>
                  )}
                  {v.observacoes && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Observações:</strong> {v.observacoes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
