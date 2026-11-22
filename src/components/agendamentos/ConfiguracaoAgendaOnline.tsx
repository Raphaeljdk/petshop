'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Horarios = {
  enabled: boolean
  diasSemana: string
  abre: string
  fecha: string
  intervaloMinutos: 15 | 30 | 60
}
const inicial: Horarios = { enabled: false, diasSemana: '', abre: '', fecha: '', intervaloMinutos: 30 }
const dias = [
  { id: 0, nome: 'Dom' }, { id: 1, nome: 'Seg' }, { id: 2, nome: 'Ter' },
  { id: 3, nome: 'Qua' }, { id: 4, nome: 'Qui' }, { id: 5, nome: 'Sex' },
  { id: 6, nome: 'Sáb' },
]

export function ConfiguracaoAgendaOnline() {
  const [config, setConfig] = useState<Horarios>(inicial)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    fetch('/api/admin/agenda/online', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar regras de agenda.')
        return data.config as Horarios
      })
      .then(setConfig)
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao carregar agenda online.'))
      .finally(() => setLoading(false))
  }, [])
  const selecionados = config.diasSemana.split(',').filter(Boolean).map(Number)
  function alternarDia(dia: number) {
    setConfig((atual) => {
      const atualDias = atual.diasSemana.split(',').filter(Boolean).map(Number)
      return { ...atual, diasSemana: (atualDias.includes(dia)
        ? atualDias.filter((d) => d !== dia) : [...atualDias, dia]).sort().join(',') }
    })
  }
  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/agenda/online', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, diasSemana: selecionados }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar o expediente.')
      setConfig(data.config)
      toast.success(config.enabled ? 'Agendamento online habilitado com os horários informados.' : 'Regras salvas; agendamento online desativado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar a agenda online.')
    } finally { setSaving(false) }
  }
  return (
    <details className="rounded-xl border bg-card p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Agendamento direto pelo site · {loading ? 'carregando' : config.enabled ? 'ativo' : 'desativado'}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Defina o expediente oficial antes de liberar reservas automáticas. O sistema usa a agenda dos profissionais,
        respeita os horários bloqueados e oferece somente serviços com duração confirmada.
      </p>
      {loading ? <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin"/>Carregando...</p> : (
        <form className="mt-4 space-y-4" onSubmit={salvar}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={config.enabled} disabled={saving}
              onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))} />
            Permitir que clientes façam reservas diretamente pelo site
          </label>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">Dias de atendimento</legend>
            <div className="flex flex-wrap gap-2">{dias.map((dia) => (
              <label key={dia.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
                <input type="checkbox" checked={selecionados.includes(dia.id)} disabled={saving}
                  onChange={() => alternarDia(dia.id)} />{dia.nome}
              </label>
            ))}</div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="online-abre">Abertura (Brasília)</Label>
              <Input id="online-abre" type="time" value={config.abre} disabled={saving}
                onChange={(e) => setConfig((p) => ({ ...p, abre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="online-fecha">Fechamento (Brasília)</Label>
              <Input id="online-fecha" type="time" value={config.fecha} disabled={saving}
                onChange={(e) => setConfig((p) => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="online-intervalo">Intervalo entre horários</Label>
              <select id="online-intervalo" className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={saving} value={config.intervaloMinutos}
                onChange={(e) => setConfig((p) => ({ ...p, intervaloMinutos: Number(e.target.value) as 15 | 30 | 60 }))}>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Reservas com antecedência mínima de 15 minutos, até 90 dias à frente. Somente após salvar com a opção
            ativada o cliente poderá escolher um horário. Sem publicação automática de preços.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Salvar regras da agenda
          </Button>
          <span className="ml-2 text-xs text-muted-foreground"><CalendarCheck2 className="mr-1 inline size-3.5" />Horários de São Paulo (Brasília)</span>
        </form>
      )}
    </details>
  )
}
