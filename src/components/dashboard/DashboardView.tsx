'use client'
import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Dog, FileText, Package, RefreshCw, ShoppingCart, Wallet, Users, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DashboardComercial } from '@/components/dashboard/DashboardComercial'

type Metrics = {
  clientes: number; pets: number; produtos: number; atendimentos: number; agendamentosHoje: number
  vendasPendentes: number; estoqueBaixo: number; notasPendentes: number; notasEmitidas: number
  receitaMes: number; vendasMes: number; contasPortal: number
  ultimosAtendimentos: Array<{ id: string; status: string; servico: string; valorServico: number; createdAt: string; pet: { nome: string; cliente: { nome: string } } }>
  proximosAgendamentos: Array<{ id: string; status: string; dataHora: string; servico: string; pet: { nome: string }; cliente: { nome: string } }>
}
type Props = {
  onIrParaKanban?: () => void; onIrParaAgendamentos?: () => void; onNovoAgendamento?: () => void
  onNovoProduto?: () => void; onIrParaEcommerce?: () => void; onNovaVenda?: () => void
  onIrParaNotificacoes?: () => void; onIrParaClientes?: () => void; onIrParaIntegracoes?: () => void
  onIrParaEntregas?: () => void; onIrParaPagamentos?: () => void; onIrParaFiscal?: () => void
}
const money = (x: number) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const day = (x: string) => new Date(x).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
export function DashboardView({onIrParaKanban,onIrParaAgendamentos,onIrParaEcommerce,onIrParaClientes,
  onIrParaEntregas,onIrParaPagamentos,onIrParaFiscal}:Props) {
  const [data,setData] = useState<Metrics|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState<string|null>(null)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { credentials:'same-origin',cache:'no-store' })
      const result = await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(result.error||'Falha ao carregar indicadores.')
      setData(result); setError(null)
    } catch(e){setError(e instanceof Error?e.message:'Falha ao consultar painel.')}
    finally {setLoading(false)}
  },[])
  useEffect(()=>{void fetchData();const timer=setInterval(()=>void fetchData(),60_000);return()=>clearInterval(timer)},[fetchData])
  if(loading&&!data) return <SkeletonLoader type="dashboard"/>
  if(error&&!data) return <Card><CardContent className="py-12 text-center"><AlertTriangle className="mx-auto size-8 text-destructive"/><p className="mt-2">{error}</p><Button className="mt-3" onClick={()=>void fetchData()}>Tentar novamente</Button></CardContent></Card>
  const kpis=[
    {label:'Clientes ativos',value:data?.clientes||0,icon:Users,onClick:onIrParaClientes},
    {label:'Pets ativos',value:data?.pets||0,icon:Dog,onClick:onIrParaClientes},
    {label:'Produtos',value:data?.produtos||0,icon:Package,onClick:onIrParaEcommerce},
    {label:'Atendimentos',value:data?.atendimentos||0,icon:Activity,onClick:onIrParaKanban},
    {label:'Agenda de hoje',value:data?.agendamentosHoje||0,icon:CalendarClock,onClick:onIrParaAgendamentos},
    {label:'Pedidos pendentes',value:data?.vendasPendentes||0,icon:ShoppingCart,onClick:onIrParaPagamentos},
    {label:'Estoque baixo',value:data?.estoqueBaixo||0,icon:AlertTriangle,onClick:onIrParaEcommerce},
    {label:'NF-e pendentes',value:data?.notasPendentes||0,icon:FileText,onClick:onIrParaFiscal},
    {label:'NF-e autorizadas',value:data?.notasEmitidas||0,icon:CheckCircle2,onClick:onIrParaFiscal},
  ]
  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r from-card to-primary/5 p-5 sm:p-7">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Sua matilha, em dia</p><h1 className="text-2xl font-bold">Visão geral · ERP próprio</h1><p className="mt-1 text-sm text-muted-foreground">Indicadores reais de clientes, agenda, estoque, vendas e notas no banco Matilha Prado.</p></div>
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={()=>void fetchData()}><RefreshCw className={'mr-2 size-4 '+(loading?'animate-spin':'')}/>Atualizar</Button>
    </div>
    {error&&<p role="status" className="text-sm text-destructive">Falha na atualização: {error}. Exibindo últimos dados carregados.</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {kpis.map(({label,value,icon:Icon,onClick})=><button key={label} type="button" disabled={!onClick} onClick={onClick} className="text-left disabled:cursor-default">
        <Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-4"><Icon className="size-5 text-primary"/><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>
      </button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Card><CardContent className="p-5"><div className="flex items-center gap-2"><Wallet className="size-5 text-primary"/><p className="text-sm font-medium">Vendas concluídas no mês</p></div><p className="mt-3 text-3xl font-bold">{money(data?.receitaMes||0)}</p><p className="mt-1 text-xs text-muted-foreground">{data?.vendasMes||0} venda(s) concluída(s) · valor bruto, antes de custos e impostos</p></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-center gap-2"><Users className="size-5 text-primary"/><p className="text-sm font-medium">Contas do portal</p></div><p className="mt-3 text-3xl font-bold">{data?.contasPortal||0}</p><p className="mt-1 text-xs text-muted-foreground">Acessos dos clientes ao portal Matilha Prado</p></CardContent></Card>
    </div>
    <DashboardComercial />
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardContent className="space-y-3 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Próximos agendamentos</h2><Button variant="ghost" size="sm" onClick={onIrParaAgendamentos}>Abrir agenda<ArrowUpRight className="ml-1 size-4"/></Button></div>
        {data?.proximosAgendamentos?.length?data.proximosAgendamentos.map(a=><div key={a.id} className="flex items-center justify-between gap-2 border-t py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{a.pet.nome} · {a.servico}</p><p className="text-xs text-muted-foreground">{a.cliente.nome} · {day(a.dataHora)}</p></div><Badge variant="outline">{a.status}</Badge></div>):<p className="py-5 text-sm text-muted-foreground">Sem agendamentos futuros.</p>}
      </CardContent></Card>
      <Card><CardContent className="space-y-3 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Últimos atendimentos</h2><Button variant="ghost" size="sm" onClick={onIrParaKanban}>Abrir Kanban<ArrowUpRight className="ml-1 size-4"/></Button></div>
        {data?.ultimosAtendimentos?.length?data.ultimosAtendimentos.map(a=><div key={a.id} className="flex items-center justify-between gap-2 border-t py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{a.pet?.nome||'Pet'} · {a.servico}</p><p className="text-xs text-muted-foreground">{a.pet?.cliente?.nome||'Tutor'} · {day(a.createdAt)} · {money(a.valorServico)}</p></div><Badge variant="outline">{a.status.replaceAll('_',' ')}</Badge></div>):<p className="py-5 text-sm text-muted-foreground">Ainda não há atendimentos.</p>}
      </CardContent></Card>
    </div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onIrParaClientes}>Clientes e pets</Button><Button variant="outline" onClick={onIrParaEcommerce}>Estoque</Button><Button variant="outline" onClick={onIrParaEntregas}>Entregas</Button><Button variant="outline" onClick={onIrParaPagamentos}>Pagamentos</Button><Button variant="outline" onClick={onIrParaFiscal}>Fiscal e Notas</Button></div>
  </div>
}
