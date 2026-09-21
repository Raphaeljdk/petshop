'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgePercent,
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Power,
  TicketPercent,
  Trash2,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CupomAdmin {
  id: string
  codigo: string
  descricao: string | null
  tipoDesconto: 'percentual' | 'fixo'
  valor: number
  valorMinimo: number
  limiteUsos: number | null
  limitePorCliente: number
  inicioEm: string | null
  fimEm: string | null
  ativo: boolean
  influenciadorNome: string | null
  influenciadorContato: string | null
  comissaoPercentual: number
  createdAt: string
  updatedAt: string
  metricas: {
    usosAprovados: number
    vendasGeradas: number
    descontosConcedidos: number
    comissaoPendente: number
    ultimoUsoEm: string | null
  }
}

interface CupomForm {
  codigo: string
  descricao: string
  tipoDesconto: 'percentual' | 'fixo'
  valor: string
  valorMinimo: string
  limiteUsos: string
  limitePorCliente: string
  inicioEm: string
  fimEm: string
  ativo: boolean
  influenciadorNome: string
  influenciadorContato: string
  comissaoPercentual: string
}

const EMPTY_FORM: CupomForm = {
  codigo: '',
  descricao: '',
  tipoDesconto: 'percentual',
  valor: '10',
  valorMinimo: '0',
  limiteUsos: '',
  limitePorCliente: '1',
  inicioEm: '',
  fimEm: '',
  ativo: true,
  influenciadorNome: '',
  influenciadorContato: '',
  comissaoPercentual: '0',
}

const fmtMoeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function statusCupom(cupom: CupomAdmin) {
  const agora = Date.now()
  if (!cupom.ativo) return { label: 'Inativo', className: 'bg-slate-100 text-slate-700 border-slate-200' }
  if (cupom.inicioEm && new Date(cupom.inicioEm).getTime() > agora) return { label: 'Agendado', className: 'bg-sky-100 text-sky-700 border-sky-200' }
  if (cupom.fimEm && new Date(cupom.fimEm).getTime() < agora) return { label: 'Expirado', className: 'bg-red-100 text-red-700 border-red-200' }
  return { label: 'Ativo', className: 'bg-green-100 text-green-700 border-green-200' }
}

function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle: string; icon: typeof TicketPercent }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="size-5" /></div>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{title}</p><p className="text-lg font-bold truncate">{value}</p><p className="text-[11px] text-muted-foreground truncate">{subtitle}</p></div>
      </CardContent>
    </Card>
  )
}

export function CuponsView() {
  const [cupons, setCupons] = useState<CupomAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<CupomAdmin | null>(null)
  const [form, setForm] = useState<CupomForm>(EMPTY_FORM)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cupons', { credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar cupons.')
      setCupons(data.cupons || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar cupons.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const metricas = useMemo(() => ({
    ativos: cupons.filter((cupom) => statusCupom(cupom).label === 'Ativo').length,
    usos: cupons.reduce((acc, cupom) => acc + cupom.metricas.usosAprovados, 0),
    vendas: cupons.reduce((acc, cupom) => acc + cupom.metricas.vendasGeradas, 0),
    comissoes: cupons.reduce((acc, cupom) => acc + cupom.metricas.comissaoPendente, 0),
  }), [cupons])

  const abrirNovo = () => {
    setEditando(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const abrirEdicao = (cupom: CupomAdmin) => {
    setEditando(cupom)
    setForm({
      codigo: cupom.codigo,
      descricao: cupom.descricao || '',
      tipoDesconto: cupom.tipoDesconto,
      valor: String(cupom.valor),
      valorMinimo: String(cupom.valorMinimo),
      limiteUsos: cupom.limiteUsos === null ? '' : String(cupom.limiteUsos),
      limitePorCliente: String(cupom.limitePorCliente),
      inicioEm: toLocalDateTime(cupom.inicioEm),
      fimEm: toLocalDateTime(cupom.fimEm),
      ativo: cupom.ativo,
      influenciadorNome: cupom.influenciadorNome || '',
      influenciadorContato: cupom.influenciadorContato || '',
      comissaoPercentual: String(cupom.comissaoPercentual),
    })
    setDialogOpen(true)
  }

  const payloadDoForm = () => ({
    codigo: form.codigo.trim().toUpperCase(),
    descricao: form.descricao.trim() || null,
    tipoDesconto: form.tipoDesconto,
    valor: Number(form.valor),
    valorMinimo: Number(form.valorMinimo || 0),
    limiteUsos: form.limiteUsos.trim() ? Number(form.limiteUsos) : null,
    limitePorCliente: Number(form.limitePorCliente || 1),
    inicioEm: form.inicioEm ? new Date(form.inicioEm).toISOString() : null,
    fimEm: form.fimEm ? new Date(form.fimEm).toISOString() : null,
    ativo: form.ativo,
    influenciadorNome: form.influenciadorNome.trim() || null,
    influenciadorContato: form.influenciadorContato.trim() || null,
    comissaoPercentual: Number(form.comissaoPercentual || 0),
  })

  const salvar = async () => {
    const payload = payloadDoForm()
    if (!payload.codigo || payload.codigo.length < 3) return toast.error('Informe um código com pelo menos 3 caracteres.')
    if (!Number.isFinite(payload.valor) || payload.valor <= 0) return toast.error('Informe um valor de desconto válido.')

    setSalvando(true)
    try {
      const res = await fetch('/api/admin/cupons', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(editando ? { id: editando.id, ...payload } : payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Não foi possível salvar o cupom.')
      toast.success(editando ? 'Cupom atualizado.' : 'Cupom criado.')
      setDialogOpen(false)
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o cupom.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (cupom: CupomAdmin) => {
    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: cupom.id, ativo: !cupom.ativo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Não foi possível alterar o cupom.')
      toast.success(!cupom.ativo ? 'Cupom ativado.' : 'Cupom desativado.')
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o cupom.')
    }
  }

  const excluir = async (cupom: CupomAdmin) => {
    const confirmou = window.confirm(cupom.metricas.usosAprovados > 0 ? 'Este cupom possui histórico. Ele será desativado, mas os relatórios serão preservados. Continuar?' : `Excluir o cupom ${cupom.codigo}?`)
    if (!confirmou) return
    try {
      const res = await fetch(`/api/admin/cupons?id=${encodeURIComponent(cupom.id)}`, { method: 'DELETE', credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Não foi possível remover o cupom.')
      toast.success(data.archived ? 'Cupom desativado e histórico preservado.' : 'Cupom excluído.')
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o cupom.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-heading gap-3">
        <div className="min-w-0"><h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cupons e parceiros</h1><p className="text-xs sm:text-sm text-muted-foreground">Crie descontos, rastreie indicações e calcule comissões de influenciadores.</p></div>
        <Button onClick={abrirNovo} className="btn-brand shrink-0"><Plus className="size-4" /> Novo cupom</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard title="Cupons ativos" value={metricas.ativos} subtitle={`${cupons.length} cadastrados`} icon={TicketPercent} />
        <StatCard title="Usos aprovados" value={metricas.usos} subtitle="Pagamentos concluídos" icon={Users} />
        <StatCard title="Vendas atribuídas" value={fmtMoeda(metricas.vendas)} subtitle="Total após descontos e frete" icon={CircleDollarSign} />
        <StatCard title="Comissões calculadas" value={fmtMoeda(metricas.comissoes)} subtitle="Base: produtos líquidos" icon={HandCoins} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Carregando cupons...</div>
      ) : cupons.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><BadgePercent className="size-12 mx-auto text-muted-foreground/40 mb-3" /><p className="font-semibold">Nenhum cupom cadastrado</p><p className="text-sm text-muted-foreground mt-1">Crie o primeiro código para uma campanha ou influenciador local.</p><Button onClick={abrirNovo} className="mt-4 btn-brand"><Plus className="size-4" /> Criar primeiro cupom</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {cupons.map((cupom) => {
            const status = statusCupom(cupom)
            const desconto = cupom.tipoDesconto === 'percentual' ? `${cupom.valor.toLocaleString('pt-BR')}% OFF` : `${fmtMoeda(cupom.valor)} OFF`
            return (
              <Card key={cupom.id} className={cn(!cupom.ativo && 'opacity-75')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><code className="rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-base font-bold tracking-wider">{cupom.codigo}</code><Badge className={cn('border', status.className)}>{status.label}</Badge></div>
                      <CardTitle className="text-base mt-2">{desconto}</CardTitle>
                      {cupom.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cupom.descricao}</p>}
                    </div>
                    <Switch checked={cupom.ativo} onCheckedChange={() => void alternarAtivo(cupom)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[10px] text-muted-foreground">Usos pagos</p><p className="font-bold">{cupom.metricas.usosAprovados}</p></div>
                    <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[10px] text-muted-foreground">Vendas</p><p className="font-bold text-sm">{fmtMoeda(cupom.metricas.vendasGeradas)}</p></div>
                    <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[10px] text-muted-foreground">Descontos</p><p className="font-bold text-sm">{fmtMoeda(cupom.metricas.descontosConcedidos)}</p></div>
                    <div className="rounded-lg bg-amber-50 p-2.5 text-amber-800"><p className="text-[10px]">Comissão</p><p className="font-bold text-sm">{fmtMoeda(cupom.metricas.comissaoPendente)}</p></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1"><p className="text-muted-foreground">Parceiro / influenciador</p><p className="font-medium">{cupom.influenciadorNome || 'Sem parceiro vinculado'}</p>{cupom.influenciadorContato && <p className="text-muted-foreground truncate">{cupom.influenciadorContato}</p>}</div>
                    <div className="space-y-1"><p className="text-muted-foreground">Regras</p><p>Comissão: <strong>{cupom.comissaoPercentual}%</strong> · mínimo: <strong>{fmtMoeda(cupom.valorMinimo)}</strong></p><p>Limite: <strong>{cupom.limiteUsos ?? 'sem limite'}</strong> · por cliente: <strong>{cupom.limitePorCliente}</strong></p></div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t pt-3"><CalendarClock className="size-3.5" /><span>{cupom.inicioEm ? new Date(cupom.inicioEm).toLocaleDateString('pt-BR') : 'Início imediato'} {' → '} {cupom.fimEm ? new Date(cupom.fimEm).toLocaleDateString('pt-BR') : 'Sem expiração'}</span></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => void alternarAtivo(cupom)}><Power className="size-3.5" /> {cupom.ativo ? 'Desativar' : 'Ativar'}</Button>
                    <Button variant="outline" size="sm" onClick={() => abrirEdicao(cupom)}><Pencil className="size-3.5" /> Editar</Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void excluir(cupom)}><Trash2 className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando ? 'Editar cupom' : 'Novo cupom'}</DialogTitle><DialogDescription>Configure o desconto, período, limites e a comissão do parceiro responsável pela indicação.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-1">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="cupom-codigo">Código</Label><Input id="cupom-codigo" value={form.codigo} onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))} placeholder="INFLUENCER10" maxLength={30} className="font-mono uppercase" /></div>
              <div className="space-y-1.5"><Label>Tipo de desconto</Label><Select value={form.tipoDesconto} onValueChange={(value) => setForm((prev) => ({ ...prev, tipoDesconto: value as 'percentual' | 'fixo' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentual">Percentual (%)</SelectItem><SelectItem value="fixo">Valor fixo (R$)</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="cupom-valor">{form.tipoDesconto === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}</Label><Input id="cupom-valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="cupom-minimo">Subtotal mínimo (R$)</Label><Input id="cupom-minimo" type="number" min="0" step="0.01" value={form.valorMinimo} onChange={(e) => setForm((prev) => ({ ...prev, valorMinimo: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="cupom-descricao">Descrição da campanha</Label><Textarea id="cupom-descricao" rows={2} value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Campanha de lançamento com parceiros locais" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="cupom-inicio">Início (opcional)</Label><Input id="cupom-inicio" type="datetime-local" value={form.inicioEm} onChange={(e) => setForm((prev) => ({ ...prev, inicioEm: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="cupom-fim">Expiração (opcional)</Label><Input id="cupom-fim" type="datetime-local" value={form.fimEm} onChange={(e) => setForm((prev) => ({ ...prev, fimEm: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="cupom-limite">Limite total de usos</Label><Input id="cupom-limite" type="number" min="1" value={form.limiteUsos} onChange={(e) => setForm((prev) => ({ ...prev, limiteUsos: e.target.value }))} placeholder="Sem limite" /></div>
              <div className="space-y-1.5"><Label htmlFor="cupom-cliente">Limite por cliente</Label><Input id="cupom-cliente" type="number" min="1" value={form.limitePorCliente} onChange={(e) => setForm((prev) => ({ ...prev, limitePorCliente: e.target.value }))} /></div>
            </div>
            <div className="rounded-xl border p-4 space-y-4">
              <div><p className="font-semibold text-sm">Parceiro / influenciador</p><p className="text-xs text-muted-foreground">O relatório considera somente vendas com pagamento aprovado.</p></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="cupom-influenciador">Nome</Label><Input id="cupom-influenciador" value={form.influenciadorNome} onChange={(e) => setForm((prev) => ({ ...prev, influenciadorNome: e.target.value }))} placeholder="Nome do parceiro" /></div>
                <div className="space-y-1.5"><Label htmlFor="cupom-contato">Contato</Label><Input id="cupom-contato" value={form.influenciadorContato} onChange={(e) => setForm((prev) => ({ ...prev, influenciadorContato: e.target.value }))} placeholder="WhatsApp, Instagram ou e-mail" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cupom-comissao">Comissão sobre produtos líquidos (%)</Label><Input id="cupom-comissao" type="number" min="0" max="100" step="0.01" value={form.comissaoPercentual} onChange={(e) => setForm((prev) => ({ ...prev, comissaoPercentual: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="cupom-ativo">Cupom ativo</Label><p className="text-xs text-muted-foreground">Pode ser validado no checkout dentro do período definido.</p></div><Switch id="cupom-ativo" checked={form.ativo} onCheckedChange={(ativo) => setForm((prev) => ({ ...prev, ativo }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>Cancelar</Button><Button className="btn-brand" onClick={() => void salvar()} disabled={salvando}>{salvando && <Loader2 className="size-4 animate-spin" />}{editando ? 'Salvar alterações' : 'Criar cupom'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
