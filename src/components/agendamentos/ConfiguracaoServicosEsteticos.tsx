'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, CircleHelp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LIMITE_PRECOS_POR_RACA, precosPorRacaSchema, type PrecoPorRaca } from '@/lib/precos-por-raca'

type Servico = {
  chave: string
  nome: string
  precoCentavos: number | null
  precosPorRaca: PrecoPorRaca[]
  duracaoMinutos: number | null
  regrasPreco: string | null
  observacoes: string | null
  confirmado: boolean
  updatedAt: string | null
}
type Rascunho = {
  preco: string
  precosPorRaca: Array<{ raca: string; preco: string }>
  duracao: string
  regrasPreco: string
  observacoes: string
  confirmado: boolean
}

const formatarPreco = (centavos: number | null) =>
  centavos === null ? '' : (centavos / 100).toFixed(2)

const editar = (s: Servico): Rascunho => ({
  preco: formatarPreco(s.precoCentavos),
  precosPorRaca: (s.precosPorRaca || []).map(({ raca, precoCentavos }) => ({ raca, preco: formatarPreco(precoCentavos) })),
  duracao: s.duracaoMinutos === null ? '' : String(s.duracaoMinutos),
  regrasPreco: s.regrasPreco ?? '',
  observacoes: s.observacoes ?? '',
  confirmado: s.confirmado,
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

  function adicionarRaca(chave: string) {
    setDrafts((prev) => {
      const atual = prev[chave]
      if (!atual || atual.precosPorRaca.length >= LIMITE_PRECOS_POR_RACA) return prev
      return {
        ...prev,
        [chave]: { ...atual, precosPorRaca: [...atual.precosPorRaca, { raca: '', preco: '' }] },
      }
    })
  }

  function alterarRaca(chave: string, indice: number, campo: 'raca' | 'preco', valor: string) {
    setDrafts((prev) => {
      const atual = prev[chave]
      if (!atual) return prev
      return {
        ...prev,
        [chave]: {
          ...atual,
          precosPorRaca: atual.precosPorRaca.map((linha, i) =>
            i === indice ? { ...linha, [campo]: valor } : linha
          ),
        },
      }
    })
  }

  function removerRaca(chave: string, indice: number) {
    setDrafts((prev) => {
      const atual = prev[chave]
      if (!atual) return prev
      return {
        ...prev,
        [chave]: { ...atual, precosPorRaca: atual.precosPorRaca.filter((_, i) => i !== indice) },
      }
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
      const precosPorRaca = precosPorRacaSchema.parse(rascunho.precosPorRaca.map((linha, indice) => {
        const precoCentavos = lerCentavos(linha.preco)
        if (precoCentavos === null) throw new Error(`Informe o preço da raça ${linha.raca.trim() || indice + 1}.`)
        return { raca: linha.raca.trim(), precoCentavos }
      }))
      const body = {
        chave,
        precoCentavos: lerCentavos(rascunho.preco),
        precosPorRaca,
        duracaoMinutos: lerDuracao(rascunho.duracao),
        regrasPreco: rascunho.regrasPreco.trim() || null,
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
        ? String(reason.issues[0]?.message || 'Revise os preços por raça.')
        : reason instanceof Error ? reason.message : 'Erro ao salvar o serviço.')
    } finally {
      setSaving(null)
    }
  }

  const confirmados = items.filter((s) => s.confirmado).length

  return (
    <details className="rounded-xl border bg-card p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Configurar serviços, preços e duração ({loading ? 'carregando' : `${confirmados}/${items.length} confirmados`})
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Preenchimento interno da Matilha Prado. Sem preços ou durações fictícios.
        Os dados não são publicados no site, não ativam reservas automáticas e não configuram impostos.
        Marque como confirmado somente após receber as informações oficiais da equipe.
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
                <span className={`inline-flex items-center gap-1 text-xs ${item.confirmado ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {item.confirmado ? <CheckCircle2 className="size-4" /> : <CircleHelp className="size-4" />}
                  {item.confirmado ? 'Confirmado' : 'Pendente'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={id + '-preco'}>Preço de referência (R$)</Label>
                  <Input id={id + '-preco'} type="text" inputMode="decimal" placeholder="A confirmar"
                    value={r.preco} onChange={(e) => alterar(id, 'preco', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={id + '-duracao'}>Duração (min)</Label>
                  <Input id={id + '-duracao'} type="number" min={5} max={720} step={1} placeholder="A confirmar"
                    value={r.duracao} onChange={(e) => alterar(id, 'duracao', e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2 rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">Preços por raça</p>
                      <p className="text-[11px] text-muted-foreground">
                        Um valor para cada raça; não substitui o preço de referência.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm"
                      disabled={saving !== null || r.precosPorRaca.length >= LIMITE_PRECOS_POR_RACA}
                      onClick={() => adicionarRaca(id)}>
                      <Plus className="mr-1 size-3.5" /> Adicionar raça
                    </Button>
                  </div>
                  {r.precosPorRaca.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma raça com preço específico cadastrada.</p>
                  )}
                  <div className="space-y-2">
                    {r.precosPorRaca.map((linha, indice) => (
                      <div key={indice} className="grid grid-cols-[minmax(0,1fr)_minmax(95px,0.6fr)_auto] items-end gap-2">
                        <div className="min-w-0 space-y-1">
                          <Label htmlFor={`${id}-raca-${indice}`}>Raça</Label>
                          <Input id={`${id}-raca-${indice}`} type="text" maxLength={80}
                            placeholder="Ex.: Golden Retriever"
                            value={linha.raca}
                            onChange={(e) => alterarRaca(id, indice, 'raca', e.target.value)} />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <Label htmlFor={`${id}-raca-preco-${indice}`}>Preço (R$)</Label>
                          <Input id={`${id}-raca-preco-${indice}`} type="text" inputMode="decimal"
                            placeholder="A confirmar"
                            value={linha.preco}
                            onChange={(e) => alterarRaca(id, indice, 'preco', e.target.value)} />
                        </div>
                        <Button type="button" variant="ghost" size="icon"
                          aria-label={`Remover preço da raça ${linha.raca || indice + 1}`}
                          disabled={saving !== null}
                          onClick={() => removerRaca(id, indice)}
                          className="size-9 text-destructive hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={id + '-regras'}>Variação por porte, pelagem, raça ou modalidade</Label>
                  <Textarea id={id + '-regras'} rows={2} maxLength={2000}
                    placeholder="Aguardando tabela de preços e critérios da equipe"
                    value={r.regrasPreco} onChange={(e) => alterar(id, 'regrasPreco', e.target.value)} />
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
