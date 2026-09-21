'use client'

import { useEffect, useState } from 'react'
import { Plus, CalendarClock, Clock, Dog } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { toast } from 'sonner'
import type { Agendamento, Pet } from '@/lib/types'
import { useAuth } from '@/components/providers/AuthProvider'

const statusVariant = (s: string) => {
  switch (s) {
    case 'agendado':
      return 'bg-blue-100 text-blue-700'
    case 'confirmado':
      return 'bg-cyan-100 text-cyan-700'
    case 'concluido':
      return 'bg-green-100 text-green-700'
    case 'cancelado':
      return 'bg-red-100 text-red-700'
    default:
      return ''
  }
}

export function ClientAgendamentos() {
  const { sessao } = useAuth()
  const zettaLinked = Boolean(sessao.user?.siggmaCliCod)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    petId: '',
    servico: '',
    dataHora: '',
    observacoes: '',
  })

  const carregar = async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/cliente/agendamentos', { credentials: 'same-origin' }),
        fetch('/api/cliente/pets', { credentials: 'same-origin' }),
      ])
      if (r1.ok) setAgendamentos(await r1.json())
      if (r2.ok) setPets(await r2.json())
    } catch (e) {
      console.error('agendamentos cliente erro:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const abrirNovo = () => {
    setForm({
      petId: pets[0]?.id || '',
      servico: '',
      dataHora: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'09:00"),
      observacoes: '',
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!form.petId || !form.servico || !form.dataHora) {
      toast.error('Preencha todos os campos')
      return
    }
    try {
      const res = await fetch('/api/cliente/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          petId: form.petId,
          servico: form.servico,
          dataHora: new Date(form.dataHora).toISOString(),
          observacoes: form.observacoes || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao agendar')
      }
      toast.success('Agendamento criado')
      setDialogOpen(false)
      carregar()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar agendamento')
    }
  }

  const futuros = agendamentos
    .filter((a) => new Date(a.dataHora).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
  const passados = agendamentos
    .filter((a) => new Date(a.dataHora).getTime() < Date.now() - 86400000)
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Marque serviços e acompanhe seus atendimentos
          </p>
        </div>
        <Button onClick={abrirNovo} disabled={pets.length === 0 || zettaLinked} className="btn-brand">
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {zettaLinked && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Seus pets vêm do Siggma/Zetta. Para evitar divergência, novos agendamentos pelo portal ficam bloqueados até confirmarmos o endpoint oficial de gravação do ERP.
          </CardContent>
        </Card>
      )}

      {pets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Dog className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Você precisa cadastrar um pet antes de agendar serviços.
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Próximos
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {loading && (
            <div className="col-span-full">
              <SkeletonLoader type="list" count={4} />
            </div>
          )}
          {!loading && futuros.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Clock className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                Nenhum agendamento futuro.
              </CardContent>
            </Card>
          )}
          {futuros.map((a) => (
            <Card key={a.id} className="card-hover">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-12 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center">
                  <span className="text-xs font-bold">{format(parseISO(a.dataHora), 'dd')}</span>
                  <span className="text-[10px] uppercase">{format(parseISO(a.dataHora), 'MMM', { locale: ptBR })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {format(parseISO(a.dataHora), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{a.servico}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.pet?.nome}
                  </p>
                </div>
                <Badge className={`text-[10px] ${statusVariant(a.status)}`}>
                  {a.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {passados.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Histórico
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {passados.map((a) => (
              <Card key={a.id} className="opacity-70">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-muted text-muted-foreground flex flex-col items-center justify-center">
                    <span className="text-xs font-bold">{format(parseISO(a.dataHora), 'dd')}</span>
                    <span className="text-[10px] uppercase">{format(parseISO(a.dataHora), 'MMM', { locale: ptBR })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.servico}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.pet?.nome}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusVariant(a.status)}`}>
                    {a.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" /> Novo agendamento
            </DialogTitle>
            <DialogDescription>Escolha o pet, serviço e horário</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pet">Pet</Label>
              <Select value={form.petId} onValueChange={(v) => setForm({ ...form, petId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="servico">Serviço</Label>
              <Input
                id="servico"
                placeholder="Banho, tosa, spa pet..."
                value={form.servico}
                onChange={(e) => setForm({ ...form, servico: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dataHora">Data e hora</Label>
              <Input
                id="dataHora"
                type="datetime-local"
                value={form.dataHora}
                onChange={(e) => setForm({ ...form, dataHora: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Alguma preferência ou cuidado especial?"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvar} className="btn-brand">Confirmar agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
