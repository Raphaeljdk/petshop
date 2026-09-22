'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, CalendarClock, Clock, Dog, Loader2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { toast } from 'sonner'
import type { Agendamento, Pet } from '@/lib/types'
import { useAuth } from '@/components/providers/AuthProvider'

type Servico = {
  id: number
  tipo: string
  descricao: string | null
}

type Horario = {
  time: string
  amount: number
  duration: number
}

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
  const [servicos, setServicos] = useState<Servico[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [form, setForm] = useState({
    petId: '',
    servicoId: '',
    servico: '',
    data: '',
    horario: '',
    dataHora: '',
    observacoes: '',
  })

  const carregar = async () => {
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/cliente/agendamentos', { credentials: 'same-origin' }),
        fetch('/api/cliente/pets', { credentials: 'same-origin' }),
      ]

      if (zettaLinked) {
        requests.push(
          fetch('/api/cliente/agendamentos/servicos', {
            credentials: 'same-origin',
          })
        )
      }

      const [r1, r2, r3] = await Promise.all(requests)

      if (r1.ok) setAgendamentos(await r1.json())
      if (r2.ok) setPets(await r2.json())

      if (r3?.ok) {
        const payload = await r3.json()
        setServicos(payload.data || [])
      }
    } catch (error) {
      console.error('agendamentos cliente erro:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  const consultarHorarios = async (data: string) => {
    if (!zettaLinked || !data) return

    setLoadingSlots(true)
    setHorarios([])

    try {
      const res = await fetch(
        `/api/cliente/agendamentos/horarios?inicio=${encodeURIComponent(data)}&fim=${encodeURIComponent(data)}`,
        { credentials: 'same-origin' }
      )
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(payload?.error || 'Erro ao consultar horários')
      }

      const dia = Array.isArray(payload?.data)
        ? payload.data.find((item: { data?: string }) => item?.data === data) || payload.data[0]
        : null

      setHorarios(Array.isArray(dia?.horarios) ? dia.horarios : [])
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar os horários'
      )
    } finally {
      setLoadingSlots(false)
    }
  }

  const abrirNovo = () => {
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

    setForm({
      petId: pets[0]?.id || '',
      servicoId: servicos[0]?.id ? String(servicos[0].id) : '',
      servico: '',
      data: tomorrow,
      horario: '',
      dataHora: format(
        new Date(Date.now() + 86400000),
        "yyyy-MM-dd'T'09:00"
      ),
      observacoes: '',
    })

    setHorarios([])
    setDialogOpen(true)

    if (zettaLinked) {
      void consultarHorarios(tomorrow)
    }
  }

  const salvar = async () => {
    if (!form.petId) {
      toast.error('Selecione o pet')
      return
    }

    if (zettaLinked && (!form.servicoId || !form.data || !form.horario)) {
      toast.error('Selecione serviço, data e horário disponível')
      return
    }

    if (!zettaLinked && (!form.servico || !form.dataHora)) {
      toast.error('Preencha serviço, data e horário')
      return
    }

    setSaving(true)

    try {
      const body = zettaLinked
        ? {
            petId: form.petId,
            servicoId: Number(form.servicoId),
            quando: `${form.data} ${form.horario}:00`,
            observacoes: form.observacoes || null,
          }
        : {
            petId: form.petId,
            servico: form.servico,
            dataHora: new Date(form.dataHora).toISOString(),
            observacoes: form.observacoes || null,
          }

      const res = await fetch('/api/cliente/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(payload?.error || 'Erro ao agendar')
      }

      toast.success(
        zettaLinked
          ? 'Agendamento criado no Siggma'
          : 'Agendamento criado'
      )
      setDialogOpen(false)
      await carregar()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar agendamento'
      )
    } finally {
      setSaving(false)
    }
  }

  const cancelar = async (agendamento: Agendamento) => {
    if (!agendamento.cancelavel) return

    try {
      const res = await fetch(
        `/api/cliente/agendamentos/${encodeURIComponent(agendamento.id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(payload?.error || 'Não foi possível cancelar')
      }

      toast.success('Agendamento cancelado')
      await carregar()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao cancelar'
      )
    }
  }

  const futuros = useMemo(
    () =>
      agendamentos
        .filter(
          (a) => new Date(a.dataHora).getTime() >= Date.now() - 86400000
        )
        .sort(
          (a, b) =>
            new Date(a.dataHora).getTime() -
            new Date(b.dataHora).getTime()
        ),
    [agendamentos]
  )

  const passados = useMemo(
    () =>
      agendamentos
        .filter(
          (a) => new Date(a.dataHora).getTime() < Date.now() - 86400000
        )
        .sort(
          (a, b) =>
            new Date(b.dataHora).getTime() -
            new Date(a.dataHora).getTime()
        ),
    [agendamentos]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Agendamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            {zettaLinked
              ? 'Agenda sincronizada com o Siggma'
              : 'Marque serviços e acompanhe seus atendimentos'}
          </p>
        </div>

        <Button
          onClick={abrirNovo}
          disabled={pets.length === 0}
          className="btn-brand"
        >
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {zettaLinked && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Os horários exibidos vêm da grade oficial do Siggma. O portal
            só envia horários retornados como disponíveis.
          </CardContent>
        </Card>
      )}

      {pets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Dog className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Você precisa ter um pet vinculado antes de agendar serviços.
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
                  <span className="text-xs font-bold">
                    {format(parseISO(a.dataHora), 'dd')}
                  </span>
                  <span className="text-[10px] uppercase">
                    {format(parseISO(a.dataHora), 'MMM', {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {format(parseISO(a.dataHora), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {a.servico}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.pet?.nome}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-[10px] ${statusVariant(a.status)}`}
                  >
                    {a.statusOriginal || a.status}
                  </Badge>

                  {a.cancelavel && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => void cancelar(a)}
                      title="Cancelar"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
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
                    <span className="text-xs font-bold">
                      {format(parseISO(a.dataHora), 'dd')}
                    </span>
                    <span className="text-[10px] uppercase">
                      {format(parseISO(a.dataHora), 'MMM', {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.servico}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.pet?.nome}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${statusVariant(a.status)}`}
                  >
                    {a.statusOriginal || a.status}
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
              <CalendarClock className="size-5 text-primary" />
              Novo agendamento
            </DialogTitle>
            <DialogDescription>
              {zettaLinked
                ? 'Selecione apenas horários disponíveis no Siggma.'
                : 'Escolha o pet, serviço e horário.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Pet</Label>
              <Select
                value={form.petId}
                onValueChange={(petId) =>
                  setForm((current) => ({ ...current, petId }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {zettaLinked ? (
              <>
                <div>
                  <Label>Serviço</Label>
                  <Select
                    value={form.servicoId}
                    onValueChange={(servicoId) =>
                      setForm((current) => ({
                        ...current,
                        servicoId,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((servico) => (
                        <SelectItem
                          key={servico.id}
                          value={String(servico.id)}
                        >
                          {servico.tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.data}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(event) => {
                      const data = event.target.value
                      setForm((current) => ({
                        ...current,
                        data,
                        horario: '',
                      }))
                      void consultarHorarios(data)
                    }}
                  />
                </div>

                <div>
                  <Label>Horário disponível</Label>
                  {loadingSlots ? (
                    <div className="h-10 flex items-center text-sm text-muted-foreground">
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Consultando Siggma...
                    </div>
                  ) : (
                    <Select
                      value={form.horario}
                      onValueChange={(horario) =>
                        setForm((current) => ({
                          ...current,
                          horario,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {horarios
                          .filter((slot) => slot.amount > 0)
                          .map((slot) => (
                            <SelectItem
                              key={slot.time}
                              value={slot.time}
                            >
                              {slot.time} · {slot.amount} vaga
                              {slot.amount === 1 ? '' : 's'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Serviço</Label>
                  <Input
                    value={form.servico}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        servico: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={form.dataHora}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dataHora: event.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => void salvar()}
              disabled={saving}
              className="btn-brand"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Confirmar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
