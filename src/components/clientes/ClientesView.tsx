'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Mail, MapPin, PawPrint, Phone, Plus, RefreshCw, Search, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { ClientInviteButton } from '@/components/admin/ClientInviteButton'
import { ClientInvitationHistory } from '@/components/admin/ClientInvitationHistory'

type PetDraft = {
  nome: string; especie: string; raca: string; porte: string; sexo: string
  nascimento: string; cor: string; castrado: boolean | null; observacoes: string; idade: string; peso: string
}
type PetRecord = PetDraft & { id: string; nascimento: string | null }
type ClienteLocal = {
  id: string; nome: string; telefone: string; email: string | null
  cpfCnpj: string | null; endereco: string | null; cep: string | null
  pets: PetRecord[]; _count?: { vendas: number; pets: number }
}
type CamposCliente = {
  nome: string; telefone: string; email: string; cpfCnpj: string; endereco: string; cep: string
}
const emptyCliente: CamposCliente = { nome: '', telefone: '', email: '', cpfCnpj: '', endereco: '', cep: '' }
const emptyPet = (): PetDraft => ({
  nome: '', especie: 'Cão', raca: '', porte: '', sexo: '', nascimento: '',
  cor: '', castrado: null, observacoes: '', idade: '', peso: '',
})
async function readResponse(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Operação não concluída.')
  return data
}
function PetFields({ value, onChange, prefix }: { value: PetDraft; onChange: (value: PetDraft) => void; prefix: string }) {
  function change(key: keyof PetDraft, next: string | boolean | null) { onChange({ ...value, [key]: next }) }
  const field = (key: keyof PetDraft, label: string, required = false) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={prefix + key}>{label}</Label>
      <Input id={prefix + key} value={String(value[key] ?? '')} maxLength={key === 'observacoes' ? 1000 : 100}
        onChange={(e) => change(key, e.target.value)} required={required}
        type={key === 'nascimento' ? 'date' : 'text'} />
    </div>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {field('nome', 'Nome do pet *', true)}
      <div className="space-y-1.5">
        <Label htmlFor={prefix + 'especie'}>Espécie *</Label>
        <select id={prefix + 'especie'} className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value.especie} onChange={(e) => change('especie', e.target.value)}>
          <option value="Cão">Cão</option><option value="Gato">Gato</option><option value="Ave">Ave</option>
          <option value="Coelho">Coelho</option><option value="Outro">Outro</option>
        </select>
      </div>
      {field('raca', 'Raça')}
      <div className="space-y-1.5"><Label htmlFor={prefix + 'porte'}>Porte</Label>
        <select id={prefix + 'porte'} className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value.porte} onChange={(e) => change('porte', e.target.value)}>
          <option value="">Não informado</option><option value="Pequeno">Pequeno</option>
          <option value="Médio">Médio</option><option value="Grande">Grande</option><option value="Gigante">Gigante</option>
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor={prefix + 'sexo'}>Sexo</Label>
        <select id={prefix + 'sexo'} className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value.sexo} onChange={(e) => change('sexo', e.target.value)}>
          <option value="">Não informado</option><option value="Macho">Macho</option><option value="Fêmea">Fêmea</option>
        </select>
      </div>
      {field('nascimento', 'Nascimento')}
      {field('cor', 'Cor')}
      {field('idade', 'Idade informada')}
      {field('peso', 'Peso / kg')}
      <div className="space-y-1.5"><Label htmlFor={prefix + 'castrado'}>Castrado?</Label>
        <select id={prefix + 'castrado'} className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value.castrado === null ? '' : value.castrado ? 'sim' : 'nao'}
          onChange={(e) => change('castrado', e.target.value === '' ? null : e.target.value === 'sim')}>
          <option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
        <Label htmlFor={prefix + 'observacoes'}>Observações</Label>
        <Input id={prefix + 'observacoes'} value={value.observacoes} maxLength={1000} onChange={(e) => change('observacoes', e.target.value)} placeholder="Alergias, cuidados especiais..." />
      </div>
    </div>
  )
}
function petToDraft(pet: PetRecord): PetDraft {
  return {
    nome: pet.nome, especie: pet.especie, raca: pet.raca || '', porte: pet.porte || '',
    sexo: pet.sexo || '', nascimento: pet.nascimento ? pet.nascimento.slice(0, 10) : '',
    cor: pet.cor || '', castrado: pet.castrado ?? null, observacoes: pet.observacoes || '',
    idade: pet.idade || '', peso: pet.peso || '',
  }
}

export function ClientesView({ onCountsChange }: { onCountsChange?: (total: number) => void }) {
  const [clientes, setClientes] = useState<ClienteLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CamposCliente>({ ...emptyCliente })
  const [novosPets, setNovosPets] = useState<PetDraft[]>([])
  const [petClienteId, setPetClienteId] = useState<string | null>(null)
  const [petEditId, setPetEditId] = useState<string | null>(null)
  const [petForm, setPetForm] = useState<PetDraft>(emptyPet())

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await readResponse(await fetch('/api/clientes', { cache: 'no-store', credentials: 'same-origin' }))
      if (!Array.isArray(data)) throw new Error('Resposta inesperada do cadastro.')
      setClientes(data)
      onCountsChange?.(data.length)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao carregar clientes.') }
    finally { setLoading(false) }
  }, [onCountsChange])

  useEffect(() => { void carregar() }, [carregar])

  const filtrados = useMemo(() => {
    const term = busca.trim().toLocaleLowerCase('pt-BR')
    return clientes.filter((c) => !term || [c.nome, c.telefone, c.email, c.cpfCnpj, ...c.pets.map(p => p.nome)]
      .some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(term)))
  }, [clientes, busca])

  function abrirNovo() {
    setEditando(null); setForm({ ...emptyCliente }); setNovosPets([])
    setPetClienteId(null); setFormAberto(true)
  }
  function abrirEdicao(c: ClienteLocal) {
    setEditando(c.id); setForm({
      nome: c.nome, telefone: c.telefone, email: c.email || '', cpfCnpj: c.cpfCnpj || '',
      endereco: c.endereco || '', cep: c.cep || '',
    })
    setPetClienteId(null); setFormAberto(true); setNovosPets([])
  }
  function abrirPet(c: ClienteLocal, pet?: PetRecord) {
    setFormAberto(false); setPetClienteId(c.id); setPetEditId(pet?.id || null)
    setPetForm(pet ? petToDraft(pet) : emptyPet())
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    try {
      const pets = novosPets.filter(p => p.nome.trim())
      const body = editando ? form : { ...form, pets }
      await readResponse(await fetch(editando ? '/api/clientes/' + editando : '/api/clientes', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body),
      }))
      toast.success(editando ? 'Cliente atualizado.' : 'Cliente e pets cadastrados.')
      setFormAberto(false); await carregar()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao salvar cliente.') }
    finally { setSalvando(false) }
  }
  async function salvarPet(e: React.FormEvent) {
    e.preventDefault()
    if (!petClienteId) return
    setSalvando(true)
    try {
      await readResponse(await fetch('/api/clientes/' + petClienteId + '/pets' + (petEditId ? '/' + petEditId : ''), {
        method: petEditId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(petForm),
      }))
      toast.success(petEditId ? 'Pet atualizado.' : 'Pet adicionado ao cliente.')
      setPetClienteId(null); await carregar()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao salvar pet.') }
    finally { setSalvando(false) }
  }
  async function excluirCliente(c: ClienteLocal) {
    if (!window.confirm('Desativar o cadastro de ' + c.nome + '? O histórico, as vendas e os pets serão preservados para auditoria.')) return
    setSalvando(true)
    try {
      await readResponse(await fetch('/api/clientes/' + c.id, { method: 'DELETE', credentials: 'same-origin' }))
      toast.success('Cliente desativado. Histórico preservado.')
      setFormAberto(false); setPetClienteId(null); await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao desativar.') }
    finally { setSalvando(false) }
  }
  async function excluirPet(c: ClienteLocal, pet: PetRecord) {
    if (!window.confirm('Remover ' + pet.nome + ' da lista de pets? Os atendimentos e agendamentos anteriores serão preservados.')) return
    setSalvando(true)
    try {
      await readResponse(await fetch('/api/clientes/' + c.id + '/pets/' + pet.id, { method: 'DELETE', credentials: 'same-origin' }))
      toast.success('Pet removido da lista; histórico preservado.')
      setPetClienteId(null); await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao remover pet.') }
    finally { setSalvando(false) }
  }
  const campo = (key: keyof CamposCliente, label: string, placeholder: string, required = false) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={'cliente-' + key}>{label}</Label>
      <Input id={'cliente-' + key} required={required} maxLength={key === 'endereco' ? 250 : 120}
        type={key === 'email' ? 'email' : 'text'} placeholder={placeholder} value={form[key]}
        onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  )
  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Clientes e pets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastros próprios do ERP · tutores, pets e histórico no mesmo lugar.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}><RefreshCw className={'size-4 ' + (loading ? ' animate-spin' : '')} /><span className="hidden sm:inline ml-2">Atualizar</span></Button>
          <Button onClick={abrirNovo}><Plus className="mr-2 size-4" />Novo cliente</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4"><UsersRound className="size-5 text-primary" /><p className="mt-2 text-2xl font-bold">{clientes.length}</p><p className="text-xs text-muted-foreground">Clientes ativos</p></CardContent></Card>
        <Card><CardContent className="p-4"><PawPrint className="size-5 text-primary" /><p className="mt-2 text-2xl font-bold">{clientes.reduce((s,c)=>s+c.pets.length,0)}</p><p className="text-xs text-muted-foreground">Pets ativos</p></CardContent></Card>
      </div>
      {formAberto && <Card className="border-primary/30"><CardContent className="p-4 sm:p-6">
        <form onSubmit={salvar} className="space-y-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editando ? 'Editar cliente' : 'Cadastrar cliente e pets'}</h2><Button type="button" variant="ghost" size="icon" onClick={()=>setFormAberto(false)} aria-label="Fechar"><X className="size-4" /></Button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo('nome','Nome completo *','Nome do cliente',true)}
            {campo('telefone','Telefone / WhatsApp *','(11) 99999-9999',true)}
            {campo('email','E-mail','cliente@exemplo.com')}
            {campo('cpfCnpj','CPF ou CNPJ','Documento fiscal')}
            {campo('cep','CEP','00000-000')}
            {campo('endereco','Endereço completo','Rua, número, bairro, cidade e UF')}
          </div>
          {!editando && <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 font-semibold"><PawPrint className="size-4" />Pets do cliente</h3><p className="text-xs text-muted-foreground">Opcional. Salvos junto ao cadastro do tutor.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={()=>setNovosPets(p=>[...p,emptyPet()])}><Plus className="mr-1.5 size-4"/>Outro pet</Button></div>
            {novosPets.map((p,i)=><div key={i} className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex justify-between"><p className="text-sm font-semibold">Pet {i+1}</p><Button type="button" variant="ghost" size="sm" onClick={()=>setNovosPets(prev=>prev.filter((_,idx)=>idx!==i))}><X className="mr-1 size-3" />Remover</Button></div>
              <PetFields prefix={'novo-pet-'+i+'-'} value={p} onChange={v=>setNovosPets(a=>a.map((x,idx)=>idx===i?v:x))}/>
            </div>)}
          </div>}
          <p className="text-xs text-muted-foreground">Clientes e pets são salvos no banco próprio. Nenhuma nota fiscal é emitida aqui.</p>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" type="button" onClick={()=>setFormAberto(false)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando?'Salvando...':editando?'Salvar cliente':'Cadastrar cliente'}</Button></div>
        </form>
      </CardContent></Card>}
      {petClienteId && <Card className="border-primary/30"><CardContent className="p-4 sm:p-6"><form className="space-y-4" onSubmit={salvarPet}>
        <div className="flex items-center justify-between"><h2 className="font-semibold">{petEditId?'Editar pet':'Adicionar pet'} · {clientes.find(c=>c.id===petClienteId)?.nome}</h2><Button type="button" variant="ghost" onClick={()=>setPetClienteId(null)}><X className="size-4" /></Button></div>
        <PetFields prefix="editar-pet-" value={petForm} onChange={setPetForm}/>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setPetClienteId(null)}>Cancelar</Button><Button disabled={salvando} type="submit">Salvar pet</Button></div>
      </form></CardContent></Card>}
      <ClientInvitationHistory />
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/><Input className="pl-10" placeholder="Buscar tutor, WhatsApp, documento ou pet..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>
      {loading?<SkeletonLoader type="cards" count={4}/>:filtrados.length===0?<Card><CardContent className="py-12 text-center"><UserRound className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm">Nenhum cliente encontrado.</p><Button className="mt-3" onClick={abrirNovo}>Cadastrar cliente</Button></CardContent></Card>:
        <div className="grid gap-3 xl:grid-cols-2">{filtrados.map(c=><Card key={c.id} className="overflow-hidden"><CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{c.nome}</p><Badge variant="secondary" className="mt-1">{c._count?.vendas||0} venda(s)</Badge></div>
            <div className="flex gap-1.5"><Button variant="outline" size="sm" onClick={()=>abrirEdicao(c)}><Edit3 className="mr-1 size-3.5"/>Editar</Button><Button variant="outline" size="sm" className="text-destructive" disabled={salvando} onClick={()=>void excluirCliente(c)}><Trash2 className="mr-1 size-3.5"/>Excluir</Button></div>
          </div>
          <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Phone className="size-4"/>{c.telefone}</span>
            {c.email&&<span className="flex items-center gap-2 break-all"><Mail className="size-4 shrink-0"/>{c.email}</span>}
            {c.cpfCnpj&&<span className="flex items-center gap-2"><UserRound className="size-4"/>{c.cpfCnpj}</span>}
            {c.endereco&&<span className="flex items-center gap-2"><MapPin className="size-4"/>{c.endereco}</span>}
          </div>
          {c.email&&<div className="mt-3"><ClientInviteButton id={c.id} nome={c.nome} email={c.email}/></div>}
          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-sm font-medium"><PawPrint className="size-4"/>Pets ({c.pets.length})</p><Button variant="outline" size="sm" onClick={()=>abrirPet(c)}><Plus className="mr-1 size-3.5"/>Adicionar pet</Button></div>
            {c.pets.length===0?<p className="text-xs text-muted-foreground">Nenhum pet cadastrado</p>:c.pets.map(p=><div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
              <div className="min-w-0"><p className="text-sm font-medium">{p.nome}</p><p className="text-xs text-muted-foreground">{p.especie}{p.raca?' · '+p.raca:''}</p></div>
              <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={()=>abrirPet(c,p)}>Editar</Button><Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={salvando} onClick={()=>void excluirPet(c,p)} aria-label={'Excluir pet '+p.nome}><Trash2 className="size-4"/></Button></div>
            </div>)}
          </div>
        </CardContent></Card>)}</div>}
    </div>
  )
}
