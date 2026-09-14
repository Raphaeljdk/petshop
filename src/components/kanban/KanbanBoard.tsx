'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dog,
  Filter,
  GripVertical,
  PawPrint,
  Plus,
  Save,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { cn } from '@/lib/utils'
import type { Pet, Processo, StatusProcesso } from '@/lib/types'

interface KanbanBoardProps {
  onCountsChange?: (counts: { novo: number; andamento: number }) => void
}

type ColunaId = 'novo' | 'em_andamento' | 'finalizado'

interface ColunaConfig {
  id: ColunaId
  titulo: string
  headerClass: string
  cardBorder: string
  dot: string
}

const COLUNAS: ColunaConfig[] = [
  {
    id: 'novo',
    titulo: 'Novo',
    headerClass: 'bg-amber-50 border-amber-200 text-amber-700',
    cardBorder: 'border-l-amber-400',
    dot: 'bg-amber-500',
  },
  {
    id: 'em_andamento',
    titulo: 'Em Andamento',
    headerClass: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    cardBorder: 'border-l-cyan-400',
    dot: 'bg-cyan-500',
  },
  {
    id: 'finalizado',
    titulo: 'Finalizado',
    headerClass: 'bg-green-50 border-green-200 text-green-700',
    cardBorder: 'border-l-green-400',
    dot: 'bg-green-500',
  },
]

const STATUS_PROCESSO_TO_COLUNA: Record<StatusProcesso, ColunaId | null> = {
  novo: 'novo',
  em_andamento: 'em_andamento',
  finalizado: 'finalizado',
  aguardando_resposta: null,
  cancelado: null,
}

const SERVICOS_FILTRO = [
  { value: 'todos', label: 'Todos os serviços' },
  { value: 'banho', label: 'Banho' },
  { value: 'tosa', label: 'Tosa' },
  { value: 'banho_e_tosa', label: 'Banho e Tosa' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'vacina', label: 'Vacina' },
] as const

const STATUS_FILTRO = [
  { value: 'todos', label: 'Todas as colunas' },
  { value: 'novo', label: 'Novo' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'finalizado', label: 'Finalizado' },
] as const

const SERVICOS_PRESET = [
  'Banho',
  'Tosa',
  'Banho e Tosa',
  'Consulta Veterinária',
  'Vacinação',
  'Tosa Higiênica',
  'Spa Pet',
]

function normalizarServico(servico: string): string {
  const s = servico.toLowerCase().trim()
  if (s.includes('banho') && s.includes('tosa')) return 'banho_e_tosa'
  if (s.includes('banho')) return 'banho'
  if (s.includes('tosa')) return 'tosa'
  if (s.includes('consult')) return 'consulta'
  if (s.includes('vacina') || s.includes('vacin')) return 'vacina'
  return s
}

/** Avatar emoji do pet baseado na espécie. */
function emojiEspecie(pet?: Pet | null): string {
  const sp = (pet?.especie || '').toLowerCase()
  if (sp.includes('cachorro') || sp.includes('canino') || sp.includes('dog')) return '🐕'
  if (sp.includes('gato') || sp.includes('felino') || sp.includes('cat')) return '🐱'
  if (sp.includes('coelho') || sp.includes('rabbit')) return '🐰'
  if (
    sp.includes('ave') ||
    sp.includes('passar') ||
    sp.includes('bird') ||
    sp.includes('papagaio') ||
    sp.includes('periquito')
  ) {
    return '🦜'
  }
  return '🐾'
}

/** Coluna-alvo direta a partir do `over.id` (caso seja o id da coluna). */
function colunaFromOverId(overId: unknown): ColunaId | null {
  if (typeof overId !== 'string') return null
  if (overId === 'novo' || overId === 'em_andamento' || overId === 'finalizado') {
    return overId
  }
  return null
}

/* --------------------------------------------------------------------- */
/* Card processo (draggable) — só o DragHandle inicia o drag              */
/* --------------------------------------------------------------------- */

interface CardProcessoProps {
  processo: Processo
  onAbrirAnamnese: (p: Processo) => void
  onMover: (novoStatus: StatusProcesso) => void
}

function CardProcesso({ processo, onAbrirAnamnese, onMover }: CardProcessoProps) {
  const colunaIdx = COLUNAS.findIndex((c) => c.id === processo.status)
  const podeAvancar = colunaIdx >= 0 && colunaIdx < COLUNAS.length - 1
  const podeVoltar = colunaIdx > 0
  const coluna = COLUNAS[colunaIdx]

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `card:${processo.id}`,
      data: { processoId: processo.id, status: processo.status },
    })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const tempoRelativo = useMemo(() => {
    const base = processo.inicioAtendimento || processo.createdAt
    try {
      return formatDistanceToNow(parseISO(base), {
        addSuffix: true,
        locale: ptBR,
      })
    } catch {
      return ''
    }
  }, [processo.inicioAtendimento, processo.createdAt])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow',
        'border-l-4',
        coluna?.cardBorder,
        isDragging && 'ring-2 ring-primary/40'
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* DragHandle — único que recebe listeners/attributes */}
          <button
            type="button"
            aria-label="Arrastar processo"
            className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none rounded"
            onPointerDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>

          <div className="flex-1 min-w-0">
            {/* Linha 1: emoji + nome pet + tempo */}
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none" aria-hidden>
                {emojiEspecie(processo.pet)}
              </span>
              <p className="text-sm font-semibold truncate flex-1">
                {processo.pet?.nome || 'Pet'}
              </p>
              {tempoRelativo && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {tempoRelativo}
                </span>
              )}
            </div>

            {/* Linha 2: serviço */}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="secondary" className="text-[10px]">
                {processo.servico}
              </Badge>
            </div>

            {/* Linha 3: dono */}
            {processo.pet?.cliente?.nome && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <User className="size-3" />
                <span className="truncate">{processo.pet.cliente.nome}</span>
              </div>
            )}

            {/* Linha 4: valor + badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-semibold">
                R$ {processo.valorServico.toFixed(2)}
              </Badge>
              {processo.anamnese ? (
                <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                  <ClipboardList className="size-3" />
                  Anamnese OK
                </Badge>
              ) : processo.status === 'em_andamento' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAbrirAnamnese(processo)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Stethoscope className="size-3" />
                  Anamnese
                </Button>
              ) : null}
            </div>

            {/* Linha 5: botões Avançar / Voltar em todos os tamanhos */}
            {(podeAvancar || podeVoltar) && (
              <div className="flex items-center gap-2 mt-2">
                {podeVoltar && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMover(COLUNAS[colunaIdx - 1].id)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ChevronLeft className="size-3.5" /> Voltar
                  </Button>
                )}
                {podeAvancar && (
                  <Button
                    size="sm"
                    className="h-8 flex-1 text-xs btn-brand"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMover(COLUNAS[colunaIdx + 1].id)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    Avançar <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- */
/* Card Overlay (durante o drag)                                          */
/* --------------------------------------------------------------------- */

function CardOverlay({ processo }: { processo: Processo }) {
  const coluna = COLUNAS.find((c) => c.id === processo.status)
  return (
    <Card
      className={cn(
        'border-l-4 shadow-xl -rotate-2 cursor-grabbing',
        coluna?.cardBorder
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>
            {emojiEspecie(processo.pet)}
          </span>
          <p className="text-sm font-semibold truncate flex-1">
            {processo.pet?.nome || 'Pet'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {processo.servico}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          <User className="size-3" />
          <span className="truncate">{processo.pet?.cliente?.nome || '—'}</span>
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------- */
/* Coluna (droppable)                                                     */
/* --------------------------------------------------------------------- */

interface ColunaProps {
  coluna: ColunaConfig
  processos: Processo[]
  loading: boolean
  onAbrirAnamnese: (p: Processo) => void
  onMover: (p: Processo, novoStatus: StatusProcesso) => void
  isOver: boolean
}

function ColunaKanban({
  coluna,
  processos,
  loading,
  onAbrirAnamnese,
  onMover,
  isOver,
}: ColunaProps) {
  const { setNodeRef } = useDroppable({ id: coluna.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border min-h-[300px] transition-colors',
        isOver
          ? 'bg-primary/5 border-primary border-2'
          : 'bg-muted/30 border-border'
      )}
    >
      {/* Header colorido */}
      <div
        className={cn(
          'p-3 border-b rounded-t-xl flex items-center justify-between',
          coluna.headerClass,
          isOver && 'bg-primary/10 border-primary'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', coluna.dot)} />
          <h3 className="font-semibold text-sm">{coluna.titulo}</h3>
        </div>
        <Badge
          variant="secondary"
          className="text-[10px] bg-white/70 text-current border-current/20"
        >
          {processos.length}
        </Badge>
      </div>

      {/* Corpo com scroll */}
      <SortableContext
        items={processos.map((p) => `card:${p.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-3 space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-[70vh]">
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg bg-muted/60 animate-pulse"
                />
              ))}
            </div>
          )}
          {!loading && processos.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground gap-2">
              <PawPrint className="size-8 opacity-40" />
              <p className="text-xs">Arraste pets para cá</p>
            </div>
          )}
          {!loading &&
            processos.map((p) => (
              <CardProcesso
                key={p.id}
                processo={p}
                onAbrirAnamnese={onAbrirAnamnese}
                onMover={(novoStatus) => onMover(p, novoStatus)}
              />
            ))}
        </div>
      </SortableContext>
    </div>
  )
}

/* --------------------------------------------------------------------- */
/* Componente principal                                                   */
/* --------------------------------------------------------------------- */

export function KanbanBoard({ onCountsChange }: KanbanBoardProps) {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  // drag state
  const [dragId, setDragId] = useState<string | null>(null)
  const [overColuna, setOverColuna] = useState<ColunaId | null>(null)

  // anamnese dialog
  const [anamneseOpen, setAnamneseOpen] = useState(false)
  const [anamneseProcesso, setAnamneseProcesso] = useState<Processo | null>(null)
  const [anamneseTexto, setAnamneseTexto] = useState('')

  // novo processo dialog
  const [novoOpen, setNovoOpen] = useState(false)
  const [novoForm, setNovoForm] = useState<{
    petId: string
    servico: string
    valorServico: string
  }>({ petId: '', servico: SERVICOS_PRESET[0], valorServico: '' })

  // filtros
  const [busca, setBusca] = useState('')
  const [filtroServico, setFiltroServico] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // confirmação ao mover para finalizado
  const [confirmFinalizar, setConfirmFinalizar] = useState<{
    processoId: string
    statusAnterior: StatusProcesso
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const carregar = useCallback(async () => {
    try {
      const [resProc, resPets] = await Promise.all([
        fetch('/api/processos', { credentials: 'same-origin' }),
        fetch('/api/pets', { credentials: 'same-origin' }),
      ])
      if (resProc.ok) {
        const data = (await resProc.json()) as Processo[]
        setProcessos(data)
        onCountsChange?.({
          novo: data.filter((p) => p.status === 'novo').length,
          andamento: data.filter((p) => p.status === 'em_andamento').length,
        })
      }
      if (resPets.ok) {
        setPets(await resPets.json())
      }
    } catch (e) {
      console.error('kanban carregar erro:', e)
    } finally {
      setLoading(false)
    }
  }, [onCountsChange])

  useEffect(() => {
    carregar()
  }, [carregar])

  const processosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return processos.filter((p) => {
      if (termo) {
        const petNome = (p.pet?.nome || '').toLowerCase()
        const donoNome = (p.pet?.cliente?.nome || '').toLowerCase()
        const servico = (p.servico || '').toLowerCase()
        if (
          !petNome.includes(termo) &&
          !donoNome.includes(termo) &&
          !servico.includes(termo)
        ) {
          return false
        }
      }
      if (filtroServico !== 'todos') {
        if (normalizarServico(p.servico) !== filtroServico) return false
      }
      if (filtroStatus !== 'todos') {
        if (p.status !== filtroStatus) return false
      }
      return true
    })
  }, [processos, busca, filtroServico, filtroStatus])

  const colunasVisiveis = useMemo(
    () =>
      filtroStatus === 'todos'
        ? COLUNAS
        : COLUNAS.filter((c) => c.id === filtroStatus),
    [filtroStatus]
  )

  const processosPorColuna = useMemo(() => {
    const map: Record<ColunaId, Processo[]> = {
      novo: [],
      em_andamento: [],
      finalizado: [],
    }
    for (const p of processosFiltrados) {
      const col = STATUS_PROCESSO_TO_COLUNA[p.status]
      if (col) map[col].push(p)
    }
    return map
  }, [processosFiltrados])

  const temFiltrosAtivos =
    busca.trim() !== '' || filtroServico !== 'todos' || filtroStatus !== 'todos'

  const limparFiltros = () => {
    setBusca('')
    setFiltroServico('todos')
    setFiltroStatus('todos')
  }

  /* ---------------------- drag handlers ---------------------- */

  const onDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id))
  }

  const onDragOver = (e: DragOverEvent) => {
    const { over } = e
    if (!over) {
      setOverColuna(null)
      return
    }
    const col = colunaFromOverId(over.id)
    if (col) {
      setOverColuna(col)
      return
    }
    if (typeof over.id === 'string' && over.id.startsWith('card:')) {
      const procId = over.id.replace('card:', '')
      const proc = processos.find((p) => p.id === procId)
      if (proc) {
        const c = STATUS_PROCESSO_TO_COLUNA[proc.status]
        if (c) {
          setOverColuna(c)
          return
        }
      }
    }
    setOverColuna(null)
  }

  const onDragCancel = (_e: DragCancelEvent) => {
    setDragId(null)
    setOverColuna(null)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    setDragId(null)
    setOverColuna(null)
    if (!over) return

    const activeId = String(active.id).replace('card:', '')
    const processo = processos.find((p) => p.id === activeId)
    if (!processo) return

    let novoStatus: ColunaId | null = colunaFromOverId(over.id)
    if (!novoStatus && typeof over.id === 'string' && over.id.startsWith('card:')) {
      const procId = over.id.replace('card:', '')
      const alvo = processos.find((p) => p.id === procId)
      if (alvo) {
        const c = STATUS_PROCESSO_TO_COLUNA[alvo.status]
        if (c) novoStatus = c
      }
    }
    if (!novoStatus) return
    if (novoStatus === processo.status) return

    const statusAnterior = processo.status

    if (novoStatus === 'finalizado' && statusAnterior !== 'finalizado') {
      setConfirmFinalizar({ processoId: activeId, statusAnterior })
      return
    }

    await aplicarMovimentacao(activeId, statusAnterior, novoStatus)
  }

  /* ---------------------- mover (drag OU botão) ---------------------- */

  const aplicarMovimentacao = async (
    processoId: string,
    statusAnterior: StatusProcesso,
    novoStatus: StatusProcesso
  ) => {
    const processo = processos.find((p) => p.id === processoId)
    if (!processo) return
    setProcessos((prev) =>
      prev.map((p) =>
        p.id === processoId ? { ...p, status: novoStatus } : p
      )
    )

    try {
      const body: Record<string, unknown> = { status: novoStatus }
      if (novoStatus === 'em_andamento' && !processo.inicioAtendimento) {
        body.inicioAtendimento = new Date().toISOString()
      }
      if (novoStatus === 'finalizado' && !processo.fimAtendimento) {
        body.fimAtendimento = new Date().toISOString()
      }
      const res = await fetch(`/api/processos/${processoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('patch-failed')
      const colunaTitulo = COLUNAS.find((c) => c.id === novoStatus)?.titulo
      if (novoStatus === 'finalizado') {
        toast.success(
          `${processo.pet?.nome || 'Pet'} finalizado — SMS/Email enviado ao dono`
        )
      } else {
        toast.success(`Movido para ${colunaTitulo}`)
      }

      if (
        novoStatus === 'em_andamento' &&
        statusAnterior === 'novo' &&
        !processo.anamnese
      ) {
        const atualizado = { ...processo, status: novoStatus }
        setAnamneseProcesso(atualizado)
        setAnamneseTexto('')
        setAnamneseOpen(true)
      }
    } catch {
      toast.error('Erro ao mover processo')
      setProcessos((prev) =>
        prev.map((p) =>
          p.id === processoId ? { ...p, status: statusAnterior } : p
        )
      )
    }
  }

  const moverProcesso = (processo: Processo, novoStatus: StatusProcesso) => {
    if (novoStatus === processo.status) return
    const statusAnterior = processo.status
    if (novoStatus === 'finalizado' && statusAnterior !== 'finalizado') {
      setConfirmFinalizar({ processoId: processo.id, statusAnterior })
      return
    }
    void aplicarMovimentacao(processo.id, statusAnterior, novoStatus)
  }

  /* ---------------------- anamnese ---------------------- */

  const abrirAnamnese = (p: Processo) => {
    setAnamneseProcesso(p)
    setAnamneseTexto(p.anamnese || '')
    setAnamneseOpen(true)
  }

  const salvarAnamnese = async () => {
    if (!anamneseProcesso) return
    try {
      const res = await fetch(`/api/processos/${anamneseProcesso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          anamnese: anamneseTexto,
          inicioAtendimento: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('patch-anamnese-failed')
      toast.success('Anamnese salva')
      setAnamneseOpen(false)
      setAnamneseProcesso(null)
      carregar()
    } catch {
      toast.error('Erro ao salvar anamnese')
    }
  }

  /* ---------------------- novo atendimento ---------------------- */

  const criarNovoProcesso = async () => {
    if (!novoForm.petId || !novoForm.servico) {
      toast.error('Selecione pet e serviço')
      return
    }
    const pet = pets.find((p) => p.id === novoForm.petId)
    if (!pet) {
      toast.error('Pet inválido')
      return
    }
    try {
      const res = await fetch('/api/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          petId: novoForm.petId,
          servico: novoForm.servico,
          valorServico: Number(novoForm.valorServico) || 0,
          status: 'novo',
        }),
      })
      if (!res.ok) throw new Error('post-failed')
      toast.success('Atendimento criado na coluna "Novo"')
      setNovoOpen(false)
      setNovoForm({
        petId: pets[0]?.id || '',
        servico: SERVICOS_PRESET[0],
        valorServico: '',
      })
      carregar()
    } catch {
      toast.error('Erro ao criar atendimento')
    }
  }

  /* ---------------------- processo ativo no overlay ---------------------- */

  const processoAtivo = useMemo(
    () =>
      dragId
        ? processos.find((p) => `card:${p.id}` === dragId) || null
        : null,
    [dragId, processos]
  )

  const totalPets = processos.length

  /* ---------------------- render ---------------------- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate flex items-center gap-2">
            Kanban de Pets
            <Badge variant="secondary" className="text-[10px]">
              <Dog className="size-3" /> {totalPets}
            </Badge>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Arraste cards entre colunas para atualizar o status
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} className="h-9 sm:h-10 shrink-0">
          <Plus className="size-4" />
          <span className="ml-1 hidden sm:inline">Novo Atendimento</span>
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por pet, dono ou serviço..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={filtroServico} onValueChange={setFiltroServico}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <Filter className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              {SERVICOS_FILTRO.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTRO.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {temFiltrosAtivos && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Mostrando {processosFiltrados.length} de {processos.length} processo(s)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-7 text-xs"
            >
              <X className="size-3" /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonLoader type="kanban" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          {/* Desktop: grid 3 colunas */}
          <div className="hidden md:grid gap-4 md:grid-cols-3">
            {colunasVisiveis.map((col) => (
              <ColunaKanban
                key={col.id}
                coluna={col}
                processos={processosPorColuna[col.id]}
                loading={false}
                onAbrirAnamnese={abrirAnamnese}
                onMover={moverProcesso}
                isOver={overColuna === col.id}
              />
            ))}
          </div>

          {/* Mobile: stack vertical */}
          <div className="md:hidden space-y-4">
            {colunasVisiveis.map((col) => (
              <ColunaKanban
                key={col.id}
                coluna={col}
                processos={processosPorColuna[col.id]}
                loading={false}
                onAbrirAnamnese={abrirAnamnese}
                onMover={moverProcesso}
                isOver={overColuna === col.id}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {processoAtivo ? <CardOverlay processo={processoAtivo} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Dialog anamnese */}
      <Dialog open={anamneseOpen} onOpenChange={setAnamneseOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Stethoscope className="size-5 text-cyan-600" />
              Ficha de Anamnese
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Pet: <strong>{anamneseProcesso?.pet?.nome}</strong> —{' '}
              {anamneseProcesso?.servico}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="anamnese">
                Observações, queixas, condições do pet e histórico
              </Label>
              <Textarea
                id="anamnese"
                placeholder="Descreva o estado do pet, comportamento, condições de saúde..."
                rows={6}
                value={anamneseTexto}
                onChange={(e) => setAnamneseTexto(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setAnamneseOpen(false)}
              className="w-full sm:w-auto"
            >
              <X className="size-4" /> Cancelar
            </Button>
            <Button onClick={salvarAnamnese} className="w-full sm:w-auto">
              <Save className="size-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog novo atendimento */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Plus className="size-5 text-primary" />
              Novo Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Crie um processo na coluna "Novo" para um pet existente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pet-novo">Pet</Label>
              <Select
                value={novoForm.petId}
                onValueChange={(v) => setNovoForm((s) => ({ ...s, petId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.length === 0 && (
                    <SelectItem value="_vazio" disabled>
                      Nenhum pet cadastrado
                    </SelectItem>
                  )}
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {emojiEspecie(p)} {p.nome} — {p.cliente?.nome || 'sem dono'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="servico-novo">Serviço</Label>
              <Select
                value={novoForm.servico}
                onValueChange={(v) => setNovoForm((s) => ({ ...s, servico: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICOS_PRESET.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="valor-novo">Valor (R$)</Label>
              <Input
                id="valor-novo"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={novoForm.valorServico}
                onChange={(e) =>
                  setNovoForm((s) => ({ ...s, valorServico: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setNovoOpen(false)}
              className="w-full sm:w-auto"
            >
              <X className="size-4" /> Cancelar
            </Button>
            <Button onClick={criarNovoProcesso} className="w-full sm:w-auto">
              <Plus className="size-4" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação ao mover para "finalizado" */}
      <ConfirmDialog
        open={!!confirmFinalizar}
        onOpenChange={(o) => !o && setConfirmFinalizar(null)}
        title="Finalizar atendimento?"
        description="Ao finalizar, o sistema enviará SMS e E-mail ao dono do pet avisando que o serviço está pronto. Deseja continuar?"
        confirmText="Finalizar e notificar"
        variant="default"
        onConfirm={async () => {
          if (!confirmFinalizar) return
          await aplicarMovimentacao(
            confirmFinalizar.processoId,
            confirmFinalizar.statusAnterior,
            'finalizado'
          )
        }}
      />
    </div>
  )
}
