'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, CircleHelp, Loader2, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PrecoPorRaca } from '@/lib/precos-por-raca'
import { GRUPOS_PORTE, gruposPorteSchema, lerGruposPorte, type GrupoPorte } from '@/lib/servicos-grupos-porte'

type Servico = {
  chave: string
  nome: string
  precosPorRaca: PrecoPorRaca[]
  gruposPorte: GrupoPorte[]
  gruposConfirmados: boolean
  observacoes: string | null
  confirmado: boolean
  updatedAt: string | null
}
type Rascunho = {
  grupos: Array<{ porte: GrupoPorte['porte']; racas: string; preco: string; duracao: string }>
  observacoes: string
  confirmado: boolean
}

const formatarPreco = (centavos: number | null) =>
  centavos === null ? '' : (centavos / 100).toFixed(2)

const editar = (s: Servico): Rascunho => ({
  grupos: lerGruposPorte(s.gruposPorte).map(g => ({ porte: g.porte, racas: g.racas.join('\n'), preco: formatarPreco(g.precoCentavos), duracao: g.duracaoMinutos === null ? '' : String(g.duracaoMinutos) })),
  observacoes: s.observacoes ?? '',
  confirmado: s.gruposConfirmados,
})

function lerCentavos(valor: string) {
  const texto = valor.trim()
  if (!texto) return null
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(texto))
    throw new Error('Informe um preço válido com até duas casas decimais.')
  const [inteiro, decimais = ''] = texto.replace(',', '.').split('.')
  const centavos = Number(inteiro) * 100 + Number(decimais.padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos) || centavos > 10_000_000)
    throw new Error('O preço está fora do limite permitido.')
  return centavos
}

function lerDuracao(valor: string) {
  const texto = valor.trim()
  if (!texto) return null
  if (!/^\d{1,3}$/.test(texto) || Number(texto) < 5 || Number(texto) > 720)
    throw new Error('A duração deve estar entre 5 e 720 minutos.')
  return Number(texto)
}

export function ConfiguracaoServicosEsteticos({ onServicoCriado }: { onServicoCriado?: (nome: string) => void } = {}) {
  const [items, setItems] = useState<Servico[]>([])
  const [drafts, setDrafts] = useState<Record<string, Rascunho>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nomeNovo, setNomeNovo] = useState('')
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [criando, setCriando] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const abrir = () => {
      setMostrarNovo(true)
      if (detailsRef.current) {
        detailsRef.current.open = true
        detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.addEventListener('matilha:novo-servico', abrir)
    return () => window.removeEventListener('matilha:novo-servico', abrir)
  }, [])

  useEffect(() => {
    let mounted = true
    fetch('/api/admin/agenda/servicos', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os serviços.')
        return data as { items: Servico[] }
      })
      .then((data) => {
        if (!mounted) return
        setItems(data.items)
        setDrafts(Object.fromEntries(data.items.map((s) => [s.chave, editar(s)])))
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Erro ao carregar serviços.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function alterar<K extends keyof Rascunho>(chave: string, campo: K, value: Rascunho[K]) {
    setDrafts((prev) => ({ ...prev, [chave]: { ...prev[chave], [campo]: value } }))
  }

  function alterarGrupo(chave: string, porte: GrupoPorte['porte'], campo: 'racas' | 'preco' | 'duracao', valor: string) {
    setDrafts(prev => {
      const atual = prev[chave]
      if (!atual) return prev
      return { ...prev, [chave]: { ...atual, grupos: atual.grupos.map(g => g.porte === porte ? { ...g, [campo]: valor } : g) } }
    })
  }

  async function criarServico(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nome = nomeNovo.trim()
    if (nome.length < 2) { toast.error('Informe o nome do novo serviço.'); return }
    setCriando(true)
    try {
      const res = await fetch('/api/admin/agenda/servicos', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível cadastrar o serviço.')
      const item = data.item as Servico
      setItems(prev => [...prev, item])
      setDrafts(prev => ({ ...prev, [item.chave]: editar(item) }))
      setNomeNovo('')
      setMostrarNovo(false)
      onServicoCriado?.(item.nome)
      toast.success('Serviço cadastrado! Agora configure o preço, a duração e marque como conferido.')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o serviço.')
    } finally {
      setCriando(false)
    }
  }

  async function salvar(chave: string) {
    const rascunho = drafts[chave]
    if (!rascunho) return
    setSaving(chave)
    try {
      const gruposPorte = gruposPorteSchema.parse(rascunho.grupos.map(g => ({
        porte: g.porte, racas: g.racas.split(/\n/).map(r => r.trim()).filter(Boolean),
        precoCentavos: lerCentavos(g.preco), duracaoMinutos: lerDuracao(g.duracao),
      })))
      const body = {
        chave,
        gruposPorte,
        observacoes: rascunho.observacoes.trim() || null,
        confirmado: rascunho.confirmado,
      }
      const res = await fetch('/api/admin/agenda/servicos', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar a configuração.')
      const item = data.item as Servico
      setItems((prev) => prev.map((s) => s.chave === chave ? item : s))
      setDrafts((prev) => ({ ...prev, [chave]: editar(item) }))
      toast.success('Configuração interna do serviço salva.')
    } catch (reason) {
      toast.error(reason instanceof Error && 'issues' in reason && Array.isArray(reason.issues)
        ? String(reason.issues[0]?.message || 'Revise os grupos de porte.')
        : reason instanceof Error ? reason.message : 'Erro ao salvar o serviço.')
    } finally {
      setSaving(null)
    }
  }

  const confirmados = items.filter((s) => s.gruposConfirmados).length

  return (
    <details ref={detailsRef} id="configurar-servicos" className="rounded-xl border bg-card p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Configurar serviços, preços e duração ({loading ? 'carregando' : `${confirmados}/${items.length} confirmados`})
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Configure as raças, o preço e a duração de cada grupo. Os valores antigos ficam preservados para conferência. A confirmação desta tabela não ativa reservas automáticas nem configura impostos.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div>
          <p className="text-sm font-semibold">Cadastrar novo serviço</p>
          <p className="text-xs text-muted-foreground">Inclua um serviço estético além dos já cadastrados. Ele também aparecerá na agenda administrativa.</p>
        </div>
        <Button type="button" variant="outline" size="sm" aria-expanded={mostrarNovo}
          onClick={() => setMostrarNovo(value => !value)} disabled={loading || criando}>
          <Plus className="mr-1.5 size-4" /> Novo serviço
        </Button>
      </div>
      {mostrarNovo && <form onSubmit={criarServico} className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="novo-servico-estetico">Nome do novo serviço *</Label>
          <Input id="novo-servico-estetico" name="nome" required minLength={2} maxLength={80}
            placeholder="Ex.: Banho terapêutico" value={nomeNovo} onChange={event => setNomeNovo(event.target.value)}
            disabled={criando} autoFocus />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarNovo(false)} disabled={criando}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={criando || nomeNovo.trim().length < 2}>
            {criando ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Salvar serviço
          </Button>
        </div>
      </form>}
      {loading && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const r = drafts[item.chave]
          if (!r) return null
          const id = item.chave
          return (
            <div key={id} className="rounded-lg border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{item.nome}</h3>
                <span className={`inline-flex items-center gap-1 text-xs ${item.gruposConfirmados ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {item.gruposConfirmados ? <CheckCircle2 className="size-4" /> : <CircleHelp className="size-4" />}
                  {item.gruposConfirmados ? 'Confirmado' : 'Pendente'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-3">
                  {r.grupos.map(g => {
                    const nome = GRUPOS_PORTE.find(p => p.chave === g.porte)?.nome || g.porte
                    const prefixo = id + '-' + g.porte
                    return <div key={g.porte} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <h4 className="text-sm font-semibold">Porte {nome}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={prefixo + '-preco'}>Preço (R$)</Label>
                          <Input id={prefixo + '-preco'} inputMode="decimal" value={g.preco} placeholder="A confirmar" onChange={e => alterarGrupo(id, g.porte, 'preco', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={prefixo + '-tempo'}>Tempo (min)</Label>
                          <Input id={prefixo + '-tempo'} type="number" min={5} max={720} step={1} value={g.duracao} placeholder="A confirmar" onChange={e => alterarGrupo(id, g.porte, 'duracao', e.target.value)} />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor={prefixo + '-racas'}>Raças deste grupo (uma por linha)</Label>
                          <Textarea id={prefixo + '-racas'} rows={2} value={g.racas} placeholder="Informe as raças atendidas" onChange={e => alterarGrupo(id, g.porte, 'racas', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  })}
                  {item.precosPorRaca.length > 0 && <details className="rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-medium">Consultar preços por raça anteriores (somente leitura)</summary>
                    <p className="mt-1 text-muted-foreground">Distribua essas raças nos grupos corretos após conferir os valores e tempos.</p>
                    <ul className="mt-2 space-y-1">{item.precosPorRaca.map(p => <li key={p.raca}>{p.raca} — R$ {formatarPreco(p.precoCentavos)}</li>)}</ul>
                  </details>}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={id + '-obs'}>Observações e procedimentos incluídos</Label>
                  <Textarea id={id + '-obs'} rows={2} maxLength={1000} placeholder="Aguardando confirmação"
                    value={r.observacoes} onChange={(e) => alterar(id, 'observacoes', e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={id + '-confirmado'} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input id={id + '-confirmado'} type="checkbox" checked={r.confirmado}
                    onChange={(e) => alterar(id, 'confirmado', e.target.checked)}
                    className="size-4 accent-primary" />
                  Dados conferidos com a equipe
                </label>
                <Button type="button" size="sm" disabled={saving !== null}
                  onClick={() => void salvar(id)}>
                  {saving === id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                  Salvar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}
