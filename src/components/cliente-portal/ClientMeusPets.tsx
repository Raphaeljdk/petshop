'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus,
  Dog,
  Pencil,
  Activity,
  Clock,
  CheckCircle,
  PawPrint,
  FileText,
  XCircle,
} from 'lucide-react'
import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Pet, Processo, StatusProcesso } from '@/lib/types'

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

const statusProcessoVariant = (s: string) => {
  switch (s) {
    case 'novo':
      return 'bg-amber-100 text-amber-700'
    case 'em_andamento':
      return 'bg-cyan-100 text-cyan-700'
    case 'aguardando_resposta':
      return 'bg-purple-100 text-purple-700'
    case 'finalizado':
      return 'bg-green-100 text-green-700'
    case 'cancelado':
      return 'bg-red-100 text-red-700'
    default:
      return ''
  }
}

const statusProcessoLabel = (s: string) => {
  const map: Record<string, string> = {
    novo: 'Na fila',
    em_andamento: 'Em atendimento',
    aguardando_resposta: 'Aguardando resposta',
    finalizado: 'Pronto para retirada',
    cancelado: 'Cancelado',
  }
  return map[s] || s.replace('_', ' ')
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (iso: string | null) => {
  if (!iso) return null
  try {
    const d = parseISO(iso)
    if (!isValid(d)) return null
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return null
  }
}

const fmtTempoRelativo = (iso: string | null) => {
  if (!iso) return null
  try {
    const d = parseISO(iso)
    if (!isValid(d)) return null
    return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
  } catch {
    return null
  }
}

/* --------------------------------------------------------------------- */
/* Timeline do processo                                                  */
/* --------------------------------------------------------------------- */

type StepState = 'done' | 'current' | 'pending'

interface TimelineStepProps {
  icon: typeof CheckCircle
  label: string
  time: string | null
  state: StepState
}

function TimelineStep({ icon: Icon, label, time, state }: TimelineStepProps) {
  return (
    <div className="flex flex-col items-center text-center min-w-0 flex-1">
      <div
        className={cn(
          'size-9 rounded-full flex items-center justify-center shrink-0 border-2',
          state === 'done' && 'bg-green-100 border-green-500 text-green-600',
          state === 'current' && 'bg-amber-100 border-amber-500 text-amber-600 animate-pulse',
          state === 'pending' && 'bg-muted border-border text-muted-foreground'
        )}
      >
        <Icon className="size-4" />
      </div>
      <p
        className={cn(
          'text-[11px] sm:text-xs font-medium mt-1.5 leading-tight',
          state === 'done' && 'text-green-600',
          state === 'current' && 'text-amber-600',
          state === 'pending' && 'text-muted-foreground'
        )}
      >
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
        {time || 'pendente'}
      </p>
    </div>
  )
}

function TimelineConnector({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-0.5 mx-1 mt-[18px] rounded-full bg-border relative overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 transition-colors',
          done ? 'bg-green-500' : 'bg-transparent'
        )}
      />
    </div>
  )
}

function TimelineProcesso({ processo }: { processo: Processo }) {
  if (processo.status === 'cancelado') {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-700">
        <XCircle className="size-4 shrink-0" />
        <span className="text-xs font-medium">Atendimento cancelado</span>
      </div>
    )
  }

  const status = processo.status
  // 1. Check-in: done se status ∈ {novo, em_andamento, finalizado}
  const step1Done = ['novo', 'em_andamento', 'finalizado'].includes(status)
  // 2. Em atendimento: done se status ∈ {em_andamento, finalizado}
  const step2Done = ['em_andamento', 'finalizado'].includes(status)
  // 3. Pronto: done se status = finalizado
  const step3Done = status === 'finalizado'

  // Estado "current" (amber pulsante) = próximo passo a ser feito
  const step1State: StepState = step1Done ? 'done' : 'current'
  const step2State: StepState = step2Done
    ? 'done'
    : step1Done
      ? 'current'
      : 'pending'
  const step3State: StepState = step3Done
    ? 'done'
    : step2Done
      ? 'current'
      : 'pending'

  return (
    <div className="flex items-start py-2">
      <TimelineStep
        icon={CheckCircle}
        label="Check-in"
        time={fmtTempoRelativo(processo.createdAt)}
        state={step1State}
      />
      <TimelineConnector done={step1Done} />
      <TimelineStep
        icon={Clock}
        label="Em atendimento"
        time={fmtTempoRelativo(processo.inicioAtendimento)}
        state={step2State}
      />
      <TimelineConnector done={step2Done} />
      <TimelineStep
        icon={PawPrint}
        label="Pronto"
        time={fmtTempoRelativo(processo.fimAtendimento)}
        state={step3State}
      />
    </div>
  )
}

/* --------------------------------------------------------------------- */
/* Componente principal                                                   */
/* --------------------------------------------------------------------- */

export function ClientMeusPets() {
  const { sessao } = useAuth()
  const zettaLinked = Boolean(sessao.user?.siggmaCliCod)
  const [pets, setPets] = useState<Pet[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Pet | null>(null)
  const [form, setForm] = useState<any>({})
  const [anamneseView, setAnamneseView] = useState<Processo | null>(null)

  // Ref para acesso sempre atualizado dentro do handler de realtime
  const processosRef = useRef<Processo[]>([])
  useEffect(() => {
    processosRef.current = processos
  }, [processos])

  const carregar = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/cliente/pets', { credentials: 'same-origin' }),
        fetch('/api/cliente/processos', { credentials: 'same-origin' }),
      ])
      if (r1.ok) setPets(await r1.json())
      if (r2.ok) setProcessos(await r2.json())
    } catch (e) {
      console.error('pets cliente erro:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* ---------------------- realtime: processo atualizado/finalizado ------- */

  const handleProcessoAtualizado = useCallback(
    (data: { id?: string; status?: string; petNome?: string }) => {
      const id = data?.id
      const novoStatus = data?.status
      // Tenta achar o nome do pet a partir do estado local OU do payload
      const encontrado = id
        ? processosRef.current.find((p) => p.id === id)
        : undefined
      const petNome = data?.petNome || encontrado?.pet?.nome || 'Pet'
      // Recarrega os dados
      carregar()
      if (novoStatus) {
        toast.info(
          `Atualização: ${petNome} agora está ${statusProcessoLabel(novoStatus)}!`
        )
      }
    },
    [carregar]
  )

  useRealtime([
    {
      event: 'processo:atualizado',
      handler: (d) => handleProcessoAtualizado(d || {}),
    },
    {
      event: 'processo:finalizado',
      handler: (d) =>
        handleProcessoAtualizado({
          id: d?.id,
          status: 'finalizado',
          petNome: d?.petNome,
        }),
    },
  ])

  const abrirNovo = () => {
    setEditando(null)
    setForm({
      nome: '',
      especie: 'Cão',
      raca: '',
      idade: '',
      peso: '',
    })
    setDialogOpen(true)
  }

  const abrirEdicao = (p: Pet) => {
    setEditando(p)
    setForm({
      nome: p.nome,
      especie: p.especie,
      raca: p.raca || '',
      idade: p.idade || '',
      peso: p.peso || '',
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!form.nome || !form.especie) {
      toast.error('Preencha nome e espécie')
      return
    }
    try {
      const body = {
        nome: form.nome,
        especie: form.especie,
        raca: form.raca || null,
        idade: form.idade || null,
        peso: form.peso || null,
      }
      const isEdit = !!editando
      const url = isEdit ? `/api/pets/${editando!.id}` : '/api/cliente/pets'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Pet atualizado' : 'Pet cadastrado')
      setDialogOpen(false)
      carregar()
    } catch {
      toast.error('Erro ao salvar pet')
    }
  }

  const processosDoPet = (petId: string) =>
    processos
      .filter((p) => p.petId === petId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Pets</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre seus pets e acompanhe atendimentos
          </p>
        </div>
        {zettaLinked ? (
          <Badge variant="outline" className="h-9 px-3">
            Cadastro da loja
          </Badge>
        ) : (
          <Button onClick={abrirNovo} className="btn-brand">
            <Plus className="size-4" /> Cadastrar pet
          </Button>
        )}
      </div>

      {zettaLinked && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Consulte seus pets e atendimentos. Para incluir um pet ou corrigir seus dados, fale com a equipe da loja.
          </CardContent>
        </Card>
      )}

      {loading && <SkeletonLoader type="cards" count={4} />}

      {!loading && pets.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Dog className="size-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Você ainda não cadastrou nenhum pet.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {pets.map((p) => {
          const procs = processosDoPet(p.id)
          const ultimo = procs[0]
          return (
            <Card key={p.id} className="card-hover">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                      <Dog className="size-6" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{p.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {p.especie}
                        {p.raca && ` · ${p.raca}`}
                      </p>
                    </div>
                  </div>
                  {p.origem !== 'zetta' && (
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEdicao(p)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {p.idade && (
                    <span className="px-2 py-1 bg-muted rounded">Idade: {p.idade}</span>
                  )}
                  {p.peso && (
                    <span className="px-2 py-1 bg-muted rounded">Peso: {p.peso} kg</span>
                  )}
                </div>

                {/* Timeline do último processo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <Activity className="size-3" /> Acompanhamento
                    </p>
                    {ultimo && (
                      <Badge className={`text-[10px] ${statusProcessoVariant(ultimo.status)}`}>
                        {statusProcessoLabel(ultimo.status)}
                      </Badge>
                    )}
                  </div>

                  {!ultimo && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum atendimento registrado.
                    </p>
                  )}

                  {ultimo && (
                    <>
                      <TimelineProcesso processo={ultimo} />

                      {/* Detalhes do último processo */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-muted/40 text-xs">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Serviço
                          </p>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {ultimo.servico}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Valor
                          </p>
                          <p className="font-semibold text-primary mt-0.5">
                            {fmtMoeda(ultimo.valorServico)}
                          </p>
                        </div>
                        {ultimo.inicioAtendimento && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Início
                            </p>
                            <p className="mt-0.5">
                              {fmtData(ultimo.inicioAtendimento)}
                            </p>
                          </div>
                        )}
                        {ultimo.fimAtendimento && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Fim
                            </p>
                            <p className="mt-0.5">
                              {fmtData(ultimo.fimAtendimento)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Botão ver anamnese */}
                      {ultimo.anamnese && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-[11px]"
                          onClick={() => setAnamneseView(ultimo)}
                        >
                          <FileText className="size-3" /> Ver anamnese
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Histórico resumido */}
                {procs.length > 1 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                      Ver histórico completo ({procs.length} atendimentos)
                    </summary>
                    <div className="space-y-1.5 mt-2">
                      {procs.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="size-3 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{pr.servico}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(parseISO(pr.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {pr.anamnese && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6"
                                onClick={() => setAnamneseView(pr)}
                                aria-label="Ver anamnese"
                              >
                                <FileText className="size-3" />
                              </Button>
                            )}
                            <Badge className={`text-[10px] ${statusProcessoVariant(pr.status)}`}>
                              {statusProcessoLabel(pr.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dog className="size-5 text-orange-600" />
              {editando ? 'Editar pet' : 'Cadastrar pet'}
            </DialogTitle>
            <DialogDescription>Informe os dados do seu pet</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="petNome">Nome</Label>
              <Input id="petNome" value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="especie">Espécie</Label>
              <Select value={form.especie || 'Cão'} onValueChange={(v) => setForm({ ...form, especie: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cão">Cão</SelectItem>
                  <SelectItem value="Gato">Gato</SelectItem>
                  <SelectItem value="Pássaro">Pássaro</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="raca">Raça</Label>
              <Input id="raca" placeholder="Ex: Husky Siberiano" value={form.raca || ''} onChange={(e) => setForm({ ...form, raca: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="idade">Idade</Label>
              <Input id="idade" placeholder="2 anos" value={form.idade || ''} onChange={(e) => setForm({ ...form, idade: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input id="peso" placeholder="15" value={form.peso || ''} onChange={(e) => setForm({ ...form, peso: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvar} className="btn-brand">
              {editando ? 'Salvar alterações' : 'Cadastrar pet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização da anamnese */}
      <Dialog
        open={!!anamneseView}
        onOpenChange={(o) => !o && setAnamneseView(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Anamnese
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {anamneseView?.pet?.nome
                ? `${anamneseView.pet.nome} — ${anamneseView.servico}`
                : anamneseView?.servico}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {anamneseView?.inicioAtendimento && (
              <p className="text-xs text-muted-foreground">
                Início do atendimento:{' '}
                <span className="font-medium text-foreground">
                  {fmtData(anamneseView.inicioAtendimento)}
                </span>
              </p>
            )}
            {anamneseView?.fimAtendimento && (
              <p className="text-xs text-muted-foreground">
                Fim do atendimento:{' '}
                <span className="font-medium text-foreground">
                  {fmtData(anamneseView.fimAtendimento)}
                </span>
              </p>
            )}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Observações do veterinário
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {anamneseView?.anamnese || 'Sem observações.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnamneseView(null)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
