'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Cake, CheckCircle2, FileText, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type DashboardComercialData = {
  dias: number
  periodo: { inicio: string; fim: string }
  indicadores: {
    vendido: number
    pedidos: number
    ticketMedio: number
    faturadoNfe: number
    notasAutorizadas: number
    notasAutorizadasSemData: number
  }
  canais: Array<{
    id: string
    nome: string
    pedidos: number
    vendido: number
    notasAutorizadas: number
    faturadoNfe: number
  }>
  maisVendidos: Array<{ id: string; nome: string; quantidade: number }>
  melhoresClientes: Array<{ id: string | null; nome: string; compras: number; total: number }>
  aniversarios: Array<{ id: string; nome: string; tutor: string; data: string; dias: number; idade: number }>
  evolucao: Array<{ dia: string; vendido: number; faturadoNfe: number }>
}

const dinheiro = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaMes = (iso: string) => {
  const parts = iso.split('-')
  return parts.length === 3 ? parts[2] + '/' + parts[1] : iso
}
const inteiro = (valor: number) => Number(valor || 0).toLocaleString('pt-BR')

export function DashboardComercial() {
  const [dias, setDias] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<DashboardComercialData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [revisao, setRevisao] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let consultando = false
    async function consultar() {
      if (consultando || controller.signal.aborted) return
      consultando = true
      setCarregando(true)
      try {
        const response = await fetch('/api/dashboard/comercial?dias=' + dias, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (!controller.signal.aborted && [401, 403].includes(response.status)) setData(null)
          throw new Error(json.error || 'Falha ao consultar vendas.')
        }
        if (!controller.signal.aborted) {
          setData(json as DashboardComercialData)
          setErro(null)
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setErro(error instanceof Error ? error.message : 'Não foi possível atualizar o painel.')
      } finally {
        consultando = false
        if (!controller.signal.aborted) setCarregando(false)
      }
    }
    void consultar()
    const timer = setInterval(() => void consultar(), 120000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [dias, revisao])

  const semDados = data === null || data.dias !== dias
  const maiorQuantidade = Math.max(1, ...(data?.maisVendidos.map((item) => item.quantidade) || []))
  const maiorCliente = Math.max(1, ...(data?.melhoresClientes.map((item) => item.total) || []))

  return (
    <section className="min-w-0 space-y-4" aria-label="Dashboard comercial" aria-busy={carregando}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Inteligência de negócios</p>
          <h2 className="text-xl font-bold sm:text-2xl">Vendas e faturamento por plataforma</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Acompanhe suas vendas, os canais que mais faturam e os próximos aniversários dos pets.
            Os períodos incluem hoje, no horário de São Paulo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([7, 30, 90] as const).map((numero) => (
            <Button key={numero} type="button" size="sm" variant={dias === numero ? 'default' : 'outline'}
              aria-pressed={dias === numero} onClick={() => setDias(numero)}>
              {numero} dias
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={carregando}
            onClick={() => setRevisao((atual) => atual + 1)}>
            <RefreshCw className={'mr-1 size-4 ' + (carregando ? 'animate-spin' : '')} />
            Atualizar
          </Button>
        </div>
      </div>

      {erro && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
        {erro}{data && !semDados ? ' Os últimos dados carregados estão exibidos.' : ''}
      </p>}
      {semDados ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground" role="status">
          {carregando ? 'Consultando vendas e notas fiscais...' : 'Ainda não foi possível carregar os indicadores.'}
        </CardContent></Card>
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Vendas concluídas', valor: dinheiro(data.indicadores.vendido), sub: 'Valor bruto dos pedidos', Icon: ShoppingBag },
              { label: 'Vendas com NF-e autorizada', valor: dinheiro(data.indicadores.faturadoNfe), sub: inteiro(data.indicadores.notasAutorizadas) + ' nota(s) autorizada(s) no período', Icon: CheckCircle2 },
              { label: 'Pedidos vendidos', valor: inteiro(data.indicadores.pedidos), sub: 'Loja + marketplaces', Icon: FileText },
              { label: 'Ticket médio', valor: dinheiro(data.indicadores.ticketMedio), sub: 'Por pedido concluído', Icon: TrendingUp },
            ].map(({ label, valor, sub, Icon }) => (
              <Card key={label} className="h-full">
                <CardContent className="p-4 sm:p-5">
                  <Icon className="size-5 text-primary" />
                  <p className="mt-3 text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 break-words text-xl font-bold sm:text-2xl">{valor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardContent className="p-4 sm:p-5">
                <h3 className="font-semibold">Evolução das vendas e NF-e</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {diaMes(data.periodo.inicio.slice(0, 10))} a {diaMes(data.evolucao.at(-1)?.dia || '')} · horário de São Paulo
                </p>
                <div className="mt-4 h-64 w-full" role="img" aria-label="Gráfico diário de vendas concluídas e notas fiscais autorizadas">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.evolucao} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.24} />
                      <XAxis dataKey="dia" tickFormatter={diaMes} tick={{ fontSize: 10 }} minTickGap={23} />
                      <YAxis tick={{ fontSize: 10 }} width={58} tickFormatter={(valor: number) =>
                        valor >= 1000 ? (valor / 1000).toFixed(0) + ' mil' : String(valor)} />
                      <Tooltip labelFormatter={(label) => 'Dia ' + diaMes(String(label))}
                        formatter={(valor) => dinheiro(Number(valor))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="vendido" name="Vendido" stroke="#0d9488"
                        fill="#0d9488" fillOpacity={0.12} strokeWidth={2} />
                      <Area type="monotone" dataKey="faturadoNfe" name="Vendas com NF-e autorizada"
                        stroke="#6366f1" fill="#6366f1" fillOpacity={0.09} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-w-0 space-y-4 p-4 sm:p-5">
                <h3 className="font-semibold">Faturamento por canal</h3>
                {data.canais.map((canal) => (
                  <div key={canal.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <strong>{canal.nome}</strong>
                      <span className="text-xs text-muted-foreground">{inteiro(canal.pedidos)} pedidos</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div><p className="text-xs text-muted-foreground">Vendido</p>
                        <p className="break-words font-semibold">{dinheiro(canal.vendido)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Com NF-e autorizada</p>
                        <p className="break-words font-semibold">{dinheiro(canal.faturadoNfe)}</p>
                        <p className="text-xs text-muted-foreground">{canal.notasAutorizadas} notas</p></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2"><ShoppingBag className="size-5 text-primary" />
                  <h3 className="font-semibold">Produtos mais vendidos</h3></div>
                {!data.maisVendidos.length && <p className="text-sm text-muted-foreground">Sem vendas concluídas no período.</p>}
                {data.maisVendidos.map((item, indice) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0">{indice + 1}. {item.nome}</span>
                      <strong className="shrink-0">{inteiro(item.quantidade)} un.</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary"
                        style={{ width: (100 * item.quantidade / maiorQuantidade) + '%' }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2"><Users className="size-5 text-primary" />
                  <h3 className="font-semibold">Clientes que mais gastaram</h3></div>
                {!data.melhoresClientes.length && <p className="text-sm text-muted-foreground">Sem compras com cliente vinculado.</p>}
                {data.melhoresClientes.map((item, indice) => (
                  <div key={item.id || indice} className="space-y-1">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0">{indice + 1}. {item.nome}
                        <span className="block text-xs text-muted-foreground">{item.compras} compra(s)</span>
                      </span>
                      <strong className="max-w-[50%] break-words text-right">{dinheiro(item.total)}</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary"
                        style={{ width: (100 * item.total / maiorCliente) + '%' }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Pedidos de marketplaces sem cliente vinculado não entram neste ranking.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2"><Cake className="size-5 text-primary" />
                  <h3 className="font-semibold">Aniversários dos pets</h3></div>
                <p className="text-xs text-muted-foreground">Hoje e próximos 30 dias, a partir da data de nascimento cadastrada.</p>
                {!data.aniversarios.length && <p className="text-sm text-muted-foreground">Nenhum aniversário cadastrado para os próximos 30 dias.</p>}
                <div className="max-h-96 space-y-3 overflow-y-auto overscroll-contain" tabIndex={data.aniversarios.length ? 0 : undefined}
                  role="region" aria-label="Lista de aniversários dos pets">
                {data.aniversarios.map((pet) => (
                  <div key={pet.id} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium">{pet.nome} <span className="text-muted-foreground">· {pet.idade} ano(s)</span></p>
                      <p className="text-xs text-muted-foreground">Tutor: {pet.tutor}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{diaMes(pet.data)}</p>
                      <p className="text-xs text-muted-foreground">{pet.dias === 0 ? 'Hoje! 🎉' : 'Em ' + pet.dias + ' dia(s)'}</p>
                    </div>
                  </div>
                ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Critérios: vendas pagas e concluídas pela data do pedido; vendas com NF-e modelo 55 autorizada,
            não cancelada, pela data de autorização. O valor associado à NF-e é o total do pedido vinculado,
            não o total extraído do XML. Os dois indicadores não devem ser somados entre si.
            Valores brutos (podem incluir frete),
            sem deduzir taxas, impostos ou devoluções posteriores. Notas Amazon FBA consultadas fora do ERP só
            entram no total fiscal quando forem vinculadas ao pedido e registradas localmente.
            {data.indicadores.notasAutorizadasSemData > 0 &&
              ' Há ' + data.indicadores.notasAutorizadasSemData + ' nota(s) autorizada(s) sem data de autorização e fora da apuração fiscal por período.'}
          </p>
        </>
      )}
    </section>
  )
}
