'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { diaSaoPaulo, type ServicoDia } from '@/lib/agenda-servicos-dia'

type Dados = {
  configurado: boolean
  excecao?:boolean
  recorrente?:boolean
  escala: ServicoDia[]
  servicos: Array<{ chave: string; nome: string; confirmado: boolean }>
  equipe: Array<{ id: string; nome: string; ativo: boolean; especialidades: string | null }>
}

export function EscalaDiariaServicos({ refreshKey = 0 }: { refreshKey?: number }) {
  const [dia, setDia] = useState(() => diaSaoPaulo(new Date()))
  const [dados, setDados] = useState<Dados | null>(null)
  const [escala, setEscala] = useState<Record<string, string[]>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [reload,setReload]=useState(0)
  const [alterado, setAlterado] = useState(false)

  useEffect(() => {
    if (!dia) return
    let cancelado = false
    setDados(null); setErro(''); setAlterado(false)
    fetch('/api/admin/agenda/escala?dia=' + encodeURIComponent(dia), { cache: 'no-store' })
      .then(async r => { const v = await r.json(); if (!r.ok) throw Error(v.error); return v as Dados })
      .then(v => { if (!cancelado) { setDados(v); setEscala(Object.fromEntries(v.escala.map(s => [s.chave, s.profissionais]))) } })
      .catch(e => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar escala.') })
    return () => { cancelado = true }
  }, [dia, refreshKey,reload])

  function marcarServico(chave: string, ativo: boolean) {
    setEscala(prev => { const next = { ...prev }; if (ativo) next[chave] = []; else delete next[chave]; return next })
    setAlterado(true)
  }
  function marcarProfissional(chave: string, id: string, ativo: boolean) {
    setEscala(prev => ({ ...prev, [chave]: ativo ? [...new Set([...(prev[chave] ?? []), id])] : (prev[chave] ?? []).filter(x => x !== id) }))
    setAlterado(true)
  }
  async function salvar() {
    if (!dados) return
    const servicos = Object.entries(escala).map(([chave, profissionais]) => ({ chave, profissionais }))
    if (servicos.some(s => !s.profissionais.length)) { toast.error('Escolha pelo menos um profissional para cada serviço marcado.'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/admin/agenda/escala', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia, servicos }) })
      const v = await r.json()
      if (!r.ok) throw Error(v.error)
      setDados(prev => prev ? { ...prev, configurado: true, excecao:true, escala: servicos } : null); setAlterado(false)
      toast.success('Disponibilidade do dia salva.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao salvar escala.') }
    finally { setSalvando(false) }
  }

  return <section className="rounded-xl border bg-card p-3 sm:p-4 space-y-3" aria-labelledby="escala-diaria">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 id="escala-diaria" className="text-sm font-semibold">Exceções de serviços por data</h2><p className="text-xs text-muted-foreground">A escala semanal é aplicada automaticamente. Altere apenas feriados, folgas ou serviços excepcionais deste dia. Os turnos semanais continuam valendo.</p></div>
      <div className="space-y-1"><Label htmlFor="escala-dia">Data</Label><Input id="escala-dia" type="date" value={dia} disabled={salvando} onChange={e => { if (alterado && !window.confirm('Descartar alterações não salvas?')) return; setDia(e.target.value) }} /></div>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {!dados && !erro && <p className="text-xs text-muted-foreground">Carregando escala...</p>}
    {dados && <>
      <div className="flex items-center gap-2"><Badge variant={dados.configurado ? 'default' : 'secondary'}>{dados.excecao?'Exceção da data':dados.recorrente?'Escala semanal':'Dia sem escala'}</Badge><span className="text-xs text-muted-foreground">{Object.keys(escala).length} serviço(s) selecionado(s)</span></div>
      <div className="grid gap-2 md:grid-cols-2">
        {dados.servicos.map(s => {
          const selecionado = Object.hasOwn(escala, s.chave)
          return <div className="rounded-lg border p-3 space-y-2" key={s.chave}>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selecionado} disabled={salvando} onChange={e => marcarServico(s.chave, e.target.checked)} className="size-4 accent-primary" />{s.nome}</label>
            {!s.confirmado && <p className="text-xs text-muted-foreground">Tabela por porte pendente de confirmação; não ofertado online.</p>}
            {selecionado && <div className="space-y-1 pl-5">
              <p className="text-xs font-medium">Profissionais responsáveis presentes</p>
              {dados.equipe.filter(p => p.ativo || escala[s.chave]?.includes(p.id)).map(p => <label className="flex items-center gap-2 text-xs" key={p.id}><input type="checkbox" className="size-4 accent-primary" checked={escala[s.chave]?.includes(p.id) ?? false} disabled={salvando || (!p.ativo && !escala[s.chave]?.includes(p.id))} onChange={e => marcarProfissional(s.chave, p.id, e.target.checked)}/>{p.nome}{p.ativo ? '' : ' (inativo)'}{p.especialidades ? ' · ' + p.especialidades : ''}</label>)}
              {!dados.equipe.some(p => p.ativo) && <p className="text-xs text-destructive">Nenhum profissional ativo.</p>}
            </div>}
          </div>
        })}
      </div>
      <div className="flex items-center justify-end gap-2">{dados.excecao&&<Button type="button" variant="outline" disabled={salvando} onClick={async()=>{if(!window.confirm('Remover a exceção e voltar ao funcionamento semanal?'))return;setSalvando(true);try{const r=await fetch('/api/admin/agenda/escala?dia='+encodeURIComponent(dia),{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('Não foi possível restaurar.');setReload(n=>n+1);toast.success('Escala semanal restaurada.')}catch(e){toast.error(e instanceof Error?e.message:'Erro.')}finally{setSalvando(false)}}}>Restaurar padrão semanal</Button>}<Button type="button" variant="outline" disabled={salvando} onClick={() => { setEscala({}); setAlterado(true) }}>Fechar todos os serviços</Button><Button type="button" disabled={salvando || !dia} onClick={() => void salvar()}>{salvando ? 'Salvando...' : 'Salvar disponibilidade'}</Button></div>
    </>}
  </section>
}
