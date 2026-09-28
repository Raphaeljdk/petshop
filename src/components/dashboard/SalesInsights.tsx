'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { portalRequest } from '@/components/cliente-portal/ExperienceProvider'
type Summary = {
  orders: number
  revenue: number
  average: number
  top: { id: string; name: string; quantity: number }[]
  lowStock: {
    id: string
    nome: string
    estoque: number
    zettaProCod: number | null
  }[]
}
const money = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function SalesInsights() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    portalRequest<Summary>('/api/admin/vendas-resumo?days=' + days)
      .then((value) => {
        if (active) {
          setData(value)
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [days])
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Vendas e oportunidades</h2>
          <p className="text-xs text-muted-foreground">
            Vendas concluídas registradas no Hub. Valores sem frete; não
            representam todo o faturamento externo do ERP.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={days === n ? 'default' : 'outline'}
              aria-pressed={days === n}
              disabled={days === n}
              onClick={() => {
                setData(null)
                setDays(n)
              }}
            >
              Últimos {n} dias
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : !data ? (
        <p role="status">Consultando vendas...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Receita em produtos', money(data.revenue)],
              ['Pedidos concluídos', String(data.orders)],
              ['Ticket médio sem frete', money(data.average)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="font-bold">Produtos mais vendidos</h3>
                {!data.top.length && (
                  <p className="text-sm text-muted-foreground">
                    Sem vendas concluídas neste período.
                  </p>
                )}
                {data.top.map((p) => (
                  <div key={p.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{p.name}</span>
                      <strong>{p.quantity}</strong>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width:
                            (p.quantity /
                              Math.max(
                                ...data.top.map((row) => row.quantity),
                                1,
                              )) *
                              100 +
                            '%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold">Atenção ao estoque</h3>
                <p className="text-xs text-muted-foreground">
                  Até 5 unidades no último estoque sincronizado. Confirme no ERP
                  antes de repor.
                </p>
                {!data.lowStock.length && (
                  <p className="text-sm">Nenhum alerta de estoque baixo.</p>
                )}
                {data.lowStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between gap-3 border-b py-2 text-sm"
                  >
                    <span>{p.nome}</span>
                    <strong
                      className={
                        p.estoque <= 0 ? 'text-red-600' : 'text-amber-700'
                      }
                    >
                      {p.estoque} un.
                    </strong>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  )
}
