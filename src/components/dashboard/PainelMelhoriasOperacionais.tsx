'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning, ImageOff, PackageSearch, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calcularMargem, type DadosMargem } from '@/lib/operational-insights'

type Diagnostico = {
  atualizadoEm: string
  catalogo: {
    total: number; semFoto: number; semMarca: number; incompletos: number
    gruposRelacionados: number; saldosDiferentes: number
    exemplosSemFoto: Array<{ id: string; nome: string }>
    exemplosDivergencias: Array<{ id: string; nome: string; saldos: Array<{ canal: string; saldo: number }> }>
  }
  pendencias: {
    solicitacoes: number; pedidos: number; estoqueCritico: number
    notasPendentes: number; notasComErro: number; conflitosAgenda: number
  }
  fiscal: {
    recentes: Array<{ id: string; status: string; serie: number | null; numero: number | null; erro: string | null }>
  }
  agenda: { totalDaSemana: number; conflitos: Array<{ id: string; dataHora: string; pets: string[] }> }
  relacionamento: { lembretesVencidos: number; favoritosSalvos: number }
  integracoes: Array<{ plataforma: string; ativo: boolean; ultimaSync: string | null }>
}

type Destinos = {
  onIrParaAgendamentos?: () => void
  onIrParaEcommerce?: () => void
  onIrParaFiscal?: () => void
  onIrParaPagamentos?: () => void
  onIrParaRelacionamento?: () => void
  onIrParaIntegracoes?: () => void
}

type Filtro = 'todas' | 'catalogo' | 'vendas' | 'agenda' | 'fiscal'
const formatar = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const CAMPOS: Array<{ key: keyof DadosMargem; label: string }> = [
  { key: 'receita', label: 'Venda recebida (R$)' },
  { key: 'custoProdutos', label: 'Custo dos produtos (R$)' },
  { key: 'taxasMarketplace', label: 'Taxas do canal (R$)' },
  { key: 'freteOperacao', label: 'Frete pago pela loja (R$)' },
  { key: 'impostos', label: 'Impostos da venda (R$)' },
  { key: 'outrosCustos', label: 'Outros custos (R$)' },
]

export function PainelMelhoriasOperacionais(destinos: Destinos) {
  const [dados, setDados] = useState<Diagnostico | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [revisao, setRevisao] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [canal, setCanal] = useState('Loja / site')
  const [entradas, setEntradas] = useState<Record<keyof DadosMargem, string>>({
    receita: '', custoProdutos: '', taxasMarketplace: '',
    freteOperacao: '', impostos: '', outrosCustos: '',
  })
  useEffect(() => {
    const controller = new AbortController()
    async function carregar() {
      setCarregando(true)
      try {
        const response = await fetch('/api/admin/diagnostico', {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Falha ao consultar a operação.')
        if (!controller.signal.aborted) {
          setDados(payload as Diagnostico)
          setErro(null)
        }
      } catch (error) {
        if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Diagnóstico indisponível.')
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }
    void carregar()
    return () => controller.abort()
  }, [revisao])

  const completo = CAMPOS.every(({ key }) => entradas[key].trim() !== '')
  const margem = calcularMargem(completo ? Object.fromEntries(
    CAMPOS.map(({ key }) => [key, Number(entradas[key])]),
  ) as DadosMargem : null)
  const mostrar = (area: Filtro) => filtro === 'todas' || filtro === area
  const pendencias = dados ? [
    { label: 'Produtos sem foto', numero: dados.catalogo.semFoto, acao: destinos.onIrParaEcommerce, area: 'catalogo' as Filtro },
    { label: 'Saldos para conferir', numero: dados.catalogo.saldosDiferentes, acao: destinos.onIrParaIntegracoes, area: 'vendas' as Filtro },
    { label: 'Pedidos pendentes', numero: dados.pendencias.pedidos, acao: destinos.onIrParaPagamentos, area: 'vendas' as Filtro },
    { label: 'Solicitações de agenda', numero: dados.pendencias.solicitacoes, acao: destinos.onIrParaRelacionamento, area: 'agenda' as Filtro },
    { label: 'NF-e com erro', numero: dados.pendencias.notasComErro, acao: destinos.onIrParaFiscal, area: 'fiscal' as Filtro },
    { label: 'Estoque crítico', numero: dados.pendencias.estoqueCritico, acao: destinos.onIrParaEcommerce, area: 'catalogo' as Filtro },
  ] : []

  return <section className="space-y-4" aria-label="Central de melhorias operacionais" aria-busy={carregando}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rotina inteligente</p>
        <h2 className="text-xl font-bold">Central de atenção e oportunidades</h2>
        <p className="text-xs text-muted-foreground">Diagnóstico do banco Matilha Prado; não executa correções nem sincronizações automaticamente.</p>
      </div>
      <Button size="sm" variant="outline" disabled={carregando} onClick={() => setRevisao((n) => n + 1)}>
        <RefreshCw className={'mr-2 size-4 ' + (carregando ? 'animate-spin' : '')}/>Atualizar
      </Button>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Filtrar informações">
      {([
        ['todas', 'Tudo'], ['catalogo', 'Catálogo'], ['vendas', 'Marketplaces e margem'],
        ['agenda', 'Agenda e clientes'], ['fiscal', 'Fiscal'],
      ] as Array<[Filtro, string]>).map(([id, label]) => <Button
        type="button" key={id} size="sm" variant={filtro === id ? 'default' : 'outline'}
        aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{label}</Button>)}
    </div>
    {erro && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
      {erro}{dados ? ' Exibindo a última consulta disponível.' : ''}
    </p>}
    {!dados ? <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">
      {carregando ? 'Consultando catálogo, marketplace, agenda e fiscal...' : 'Dados operacionais indisponíveis.'}
    </CardContent></Card> : <>
      {filtro === 'todas' && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {pendencias.map((item) => <button key={item.label} type="button"
          onClick={() => { setFiltro(item.area); if (item.acao) item.acao() }}
          className="rounded-xl border bg-card p-3 text-left transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <span className="text-2xl font-bold tabular-nums">{item.numero}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{item.label}</span>
        </button>)}
      </div>}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {mostrar('catalogo') && <Card><CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><PackageSearch className="size-4 text-primary"/>Qualidade do catálogo</h3>
            <Button size="sm" variant="outline" onClick={destinos.onIrParaEcommerce}>Abrir estoque</Button>
          </div>
          <p className="text-xs text-muted-foreground">{dados.catalogo.total.toLocaleString('pt-BR')} anúncios ativos analisados.</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/60 p-3"><strong>{dados.catalogo.semFoto}</strong><p className="text-xs">Sem imagem</p></div>
            <div className="rounded-lg bg-muted/60 p-3"><strong>{dados.catalogo.semMarca}</strong><p className="text-xs">Marca não identificada</p></div>
            <div className="rounded-lg bg-muted/60 p-3"><strong>{dados.catalogo.incompletos}</strong><p className="text-xs">Dados essenciais incompletos</p></div>
            <div className="rounded-lg bg-muted/60 p-3"><strong>{dados.catalogo.gruposRelacionados}</strong><p className="text-xs">Possíveis anúncios espelhados</p></div>
          </div>
          {dados.catalogo.exemplosSemFoto.length > 0 && <div className="space-y-1 text-xs">
            <p className="font-medium">Exemplos que precisam de foto:</p>
            {dados.catalogo.exemplosSemFoto.map((p) => <p key={p.id} className="flex items-center gap-2 truncate"><ImageOff className="size-3 shrink-0"/> {p.nome}</p>)}
          </div>}
          <p className="text-xs text-muted-foreground">Anúncios relacionados não serão excluídos automaticamente. Os filtros de marca e sem foto continuam no Estoque.</p>
        </CardContent></Card>}
        {mostrar('vendas') && <Card><CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><ShoppingBag className="size-4 text-primary"/>Conferência dos canais</h3>
            <Button size="sm" variant="outline" onClick={destinos.onIrParaIntegracoes}>Integrações</Button>
          </div>
          <p className="text-sm"><strong>{dados.catalogo.saldosDiferentes}</strong> registros com saldos distintos em fontes vinculadas.</p>
          <p className="text-xs text-muted-foreground">Diferença registrada não prova erro de sincronização. Confira depósitos, reservas e horários de atualização.</p>
          {dados.catalogo.exemplosDivergencias.map((p) => <div className="rounded-lg border p-2 text-xs" key={p.id}>
            <p className="font-medium">{p.nome}</p>
            <p className="text-muted-foreground">{p.saldos.map((x) => x.canal + ': ' + x.saldo).join('  ·  ')}</p>
          </div>)}
          <div className="space-y-1 border-t pt-2 text-xs">
            {dados.integracoes.map((i, idx) => <p key={i.plataforma + idx} className="flex flex-wrap justify-between gap-1">
              <span>{i.plataforma} · {i.ativo ? 'Ativa' : 'Inativa'}</span>
              <span className="text-muted-foreground">{i.ultimaSync ? 'Última sync: ' + new Date(i.ultimaSync).toLocaleString('pt-BR') : 'Sem sincronização registrada'}</span>
            </p>)}
          </div>
        </CardContent></Card>}
        {mostrar('fiscal') && <Card><CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><FileWarning className="size-4 text-primary"/>Acompanhamento fiscal</h3>
            <Button size="sm" variant="outline" onClick={destinos.onIrParaFiscal}>Fiscal e Notas</Button>
          </div>
          <div className="flex gap-3 text-sm"><span><strong>{dados.pendencias.notasPendentes}</strong> pendentes</span><span><strong>{dados.pendencias.notasComErro}</strong> com erro</span></div>
          {dados.fiscal.recentes.length ? dados.fiscal.recentes.map((n) => <div key={n.id} className="rounded-lg border p-2 text-xs">
            <p className="font-medium">NF-e {n.numero != null ? n.numero : 'sem numeração'} · {n.status}</p>
            {n.erro && <p className="mt-1 break-words text-muted-foreground">{n.erro}</p>}
            {!n.erro && <p className="text-muted-foreground">Consultar validações e histórico antes da emissão.</p>}
          </div>) : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4"/>Nenhuma nota pendente ou com erro encontrada.</p>}
          <p className="text-xs text-muted-foreground">Este painel não autoriza notas, não transmite XML e não altera a numeração fiscal.</p>
        </CardContent></Card>}
        {mostrar('agenda') && <Card><CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-primary"/>Agenda e relacionamento</h3>
            <Button size="sm" variant="outline" onClick={destinos.onIrParaAgendamentos}>Abrir agenda</Button>
          </div>
          <p className="text-sm"><strong>{dados.agenda.totalDaSemana}</strong> atendimentos nos próximos sete dias.</p>
          <p className="text-sm"><strong>{dados.pendencias.solicitacoes}</strong> solicitações aguardando equipe.</p>
          <p className="text-sm"><strong>{dados.agenda.conflitos.length}</strong> possíveis choques de profissional e horário identificados na amostra.</p>
          {dados.agenda.conflitos.map((c) => <p key={c.id} className="rounded-lg border border-amber-300/50 p-2 text-xs">
            <AlertTriangle className="mr-1 inline size-3"/> {c.pets.join(' e ')} — {new Date(c.dataHora).toLocaleString('pt-BR')}
          </p>)}
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs">
            <Users className="size-4 shrink-0"/>
            <div><strong>{dados.relacionamento.lembretesVencidos}</strong> lembretes de recompra vencidos · <strong>{dados.relacionamento.favoritosSalvos}</strong> favoritos de clientes.
              <p className="mt-1 text-muted-foreground">Aniversários dos pets aparecem no painel comercial. Para campanhas externas é necessária autorização do cliente e integração de mensagens.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={destinos.onIrParaRelacionamento}>Ver relacionamento</Button>
        </CardContent></Card>}
        {mostrar('vendas') && <Card><CardContent className="space-y-3 p-4 sm:p-5">
          <div><h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="size-4 text-primary"/>Simulador de margem por canal</h3>
            <p className="mt-1 text-xs text-muted-foreground">Sem custo de aquisição e tarifas consolidados no banco, o lucro real não pode ser inferido. Preencha os valores da operação.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Loja / site', 'Mercado Livre', 'Amazon'].map((nome) => <Button
              key={nome} size="sm" variant={canal === nome ? 'default' : 'outline'}
              onClick={() => setCanal(nome)}>{nome}</Button>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map(({ key, label }) => <label className="space-y-1 text-xs" key={key}>
              <span>{label}</span>
              <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Preencha"
                value={entradas[key]} onChange={(event) => setEntradas((prev) => ({ ...prev, [key]: event.target.value }))}/>
            </label>)}
          </div>
          {margem ? <div className="rounded-lg border p-3 text-sm" aria-live="polite">
            <p className="text-xs text-muted-foreground">Resultado calculado para {canal}</p>
            <p className="text-lg font-bold">{formatar(margem.lucro)}</p>
            <p className="text-xs">{margem.margemPercentual == null ? 'Margem indisponível sem receita' : 'Margem: ' + margem.margemPercentual.toLocaleString('pt-BR') + '%'}</p>
          </div> : <p className="text-xs text-muted-foreground" role="status">Informe todos os campos (use 0 somente quando confirmado).</p>}
          <Button size="sm" variant="ghost" onClick={() => setEntradas({
            receita: '', custoProdutos: '', taxasMarketplace: '', freteOperacao: '', impostos: '', outrosCustos: '',
          })}>Limpar valores</Button>
        </CardContent></Card>}
      </div>
      <p className="text-xs text-muted-foreground">Atualizado em {new Date(dados.atualizadoEm).toLocaleString('pt-BR')}. Indicadores locais; não substituem a conferência das plataformas ou da contabilidade.</p>
    </>}
  </section>
}
