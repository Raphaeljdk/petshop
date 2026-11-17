'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

type Professional={id:string;nome:string;ativo:boolean}
type Block={id:string;profissionalId:string;inicio:string;fim:string;tipo:string;observacoes:string|null;profissional:{nome:string}}
const reasonLabels:Record<string,string>={almoco:'Almoço',taxdog:'TaxDog',outro:'Outro compromisso'}
function localDate(input:string){return new Date(input).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}

export function BloqueioProfissionalDialog({profissionais,onUpdated}:{
  profissionais:Professional[];onUpdated:()=>void
}) {
  const [open,setOpen]=useState(false)
  const [list,setList]=useState<Block[]>([])
  const [profissionalId,setProfissionalId]=useState('')
  const [tipo,setTipo]=useState<'almoco'|'taxdog'|'outro'>('almoco')
  const [inicio,setInicio]=useState('')
  const [fim,setFim]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [saving,setSaving]=useState(false)
  const load=useCallback(async()=>{
    try{
      const res=await fetch('/api/agenda/bloqueios',{credentials:'same-origin',cache:'no-store'})
      const data=await res.json()
      if(res.ok)setList(data.items||[])
    }catch{toast.error('Falha ao consultar os horários bloqueados.')}
  },[])
  useEffect(()=>{if(open)void load()},[open,load])
  async function submit(event:React.FormEvent) {
    event.preventDefault()
    if(!profissionalId||!inicio||!fim)return
    const start=new Date(inicio),end=new Date(fim)
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){
      toast.error('Informe início e fim válidos, com o fim após o início.');return
    }
    setSaving(true)
    try{
      const res=await fetch('/api/agenda/bloqueios',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({profissionalId,tipo,inicio:start.toISOString(),fim:end.toISOString(),observacoes}),
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.error||'Não foi possível bloquear.')
      toast.success('Horário bloqueado para este profissional.')
      setInicio('');setFim('');setObservacoes('')
      await load();onUpdated()
    }catch(e){toast.error(e instanceof Error?e.message:'Erro ao bloquear horário.')}
    finally{setSaving(false)}
  }
  async function remove(id:string) {
    if(!window.confirm('Liberar este horário para novos agendamentos?'))return
    setSaving(true)
    try{
      const res=await fetch('/api/agenda/bloqueios?id='+encodeURIComponent(id),{
        method:'DELETE',credentials:'same-origin',
      })
      if(!res.ok)throw Error('Não foi possível liberar horário.')
      toast.success('Bloqueio removido.')
      await load();onUpdated()
    }catch(e){toast.error(e instanceof Error?e.message:'Falha ao liberar horário.')}
    finally{setSaving(false)}
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><CalendarOff className="mr-1 size-4"/>Bloquear horário</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Bloquear agenda do funcionário</DialogTitle>
        <DialogDescription>Marque almoço, TaxDog ou outro compromisso. Horários bloqueados impedem novas reservas para o funcionário selecionado.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="space-y-1 text-sm"><span className="font-medium">Funcionário *</span>
          <select required className="h-10 w-full rounded-md border bg-background px-3" value={profissionalId} onChange={e=>setProfissionalId(e.target.value)}>
            <option value="">Selecione um profissional</option>
            {profissionais.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="font-medium">Motivo *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3" value={tipo}
            onChange={e=>setTipo(e.target.value as typeof tipo)}>
            <option value="almoco">Almoço</option><option value="taxdog">TaxDog</option><option value="outro">Outro compromisso</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="bloqueio-inicio">Início *</Label><Input id="bloqueio-inicio" type="datetime-local" required value={inicio} onChange={e=>setInicio(e.target.value)}/></div>
          <div className="space-y-1"><Label htmlFor="bloqueio-fim">Fim *</Label><Input id="bloqueio-fim" type="datetime-local" required value={fim} onChange={e=>setFim(e.target.value)}/></div>
        </div>
        <div className="space-y-1"><Label htmlFor="bloqueio-observacao">Observações opcionais</Label><Input id="bloqueio-observacao" maxLength={250} value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Ex.: retirada e entrega de pets"/></div>
        <p className="text-xs text-muted-foreground">Agendamentos de referência usam janela de 60 minutos. O sistema avisa se já houver uma reserva no período.</p>
        <Button type="submit" disabled={saving||!profissionalId}>{saving?'Salvando...':'Confirmar bloqueio'}</Button>
      </form>
      <div className="max-h-60 space-y-2 overflow-auto border-t pt-3">
        <p className="text-sm font-semibold">Bloqueios cadastrados</p>
        {list.length===0&&<p className="text-xs text-muted-foreground">Nenhum horário bloqueado.</p>}
        {list.map(b=><div key={b.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
          <div><strong>{b.profissional?.nome||'Funcionário'} · {reasonLabels[b.tipo]||b.tipo}</strong>
            <p>{localDate(b.inicio)} até {localDate(b.fim)}</p>{b.observacoes&&<p className="text-muted-foreground">{b.observacoes}</p>}</div>
          <Button type="button" variant="ghost" size="sm" aria-label="Liberar bloqueio" disabled={saving} onClick={()=>void remove(b.id)}><Trash2 className="size-4"/></Button>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>
}
