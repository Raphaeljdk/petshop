'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Mail, MapPin, PawPrint, Phone, Plus, RefreshCw, Search, UserRound, UsersRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'

type ClienteLocal = {
  id: string
  nome: string
  telefone: string
  email: string | null
  cpfCnpj: string | null
  endereco: string | null
  cep: string | null
  pets: Array<{ id: string; nome: string; especie: string }>
  _count?: { vendas: number; pets: number }
}
type CamposCliente = {
  nome: string
  telefone: string
  email: string
  cpfCnpj: string
  endereco: string
  cep: string
}
const vazio: CamposCliente = { nome: '', telefone: '', email: '', cpfCnpj: '', endereco: '', cep: '' }

export function ClientesView({ onCountsChange }: { onCountsChange?: (total: number) => void }) {
  const [clientes, setClientes] = useState<ClienteLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CamposCliente>(vazio)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clientes', { credentials: 'same-origin', cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Falha ao carregar clientes.')
      setClientes(data)
      onCountsChange?.(data.length)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }, [onCountsChange])

  useEffect(() => { void carregar() }, [carregar])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return clientes
    return clientes.filter((cliente) =>
      [cliente.nome, cliente.telefone, cliente.email, cliente.cpfCnpj, ...cliente.pets.map((pet) => pet.nome)]
        .some((valor) => String(valor || '').toLocaleLowerCase('pt-BR').includes(termo))
    )
  }, [clientes, busca])

  const abrirNovo = () => {
    setEditando(null)
    setForm({ ...vazio })
    setFormAberto(true)
  }
  const abrirEdicao = (cliente: ClienteLocal) => {
    setEditando(cliente.id)
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email || '',
      cpfCnpj: cliente.cpfCnpj || '',
      endereco: cliente.endereco || '',
      cep: cliente.cep || '',
    })
    setFormAberto(true)
  }
  const salvar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error('Informe o nome e o telefone do cliente.')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch(editando ? '/api/clientes/' + editando : '/api/clientes', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar o cliente.')
      toast.success(editando ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      setFormAberto(false)
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.')
    } finally {
      setSalvando(false)
    }
  }

  const campo = (id: keyof CamposCliente, rotulo: string, placeholder: string, obrigatorio = false) => (
    <div className="space-y-1.5" key={id}>
      <Label htmlFor={'cliente-' + id}>{rotulo}</Label>
      <Input
        id={'cliente-' + id}
        required={obrigatorio}
        maxLength={id === 'endereco' ? 250 : 120}
        value={form[id]}
        onChange={(event) => setForm((atual) => ({ ...atual, [id]: event.target.value }))}
        placeholder={placeholder}
        type={id === 'email' ? 'email' : 'text'}
        autoComplete={id === 'nome' ? 'name' : id === 'email' ? 'email' : id === 'telefone' ? 'tel' : 'off'}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cadastro de clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base própria da Matilha Prado. Cadastre clientes para vendas, entregas e futuras emissões fiscais.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar clientes">
            <RefreshCw className={'size-4 ' + (loading ? 'animate-spin' : '')} />
            <span className="hidden sm:inline ml-2">Atualizar</span>
          </Button>
          <Button type="button" onClick={abrirNovo}><Plus className="mr-2 size-4" />Novo cliente</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <UsersRound className="size-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{clientes.length}</p>
          <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <PawPrint className="size-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{clientes.reduce((total, cliente) => total + cliente.pets.length, 0)}</p>
          <p className="text-xs text-muted-foreground">Pets locais</p>
        </CardContent></Card>
      </div>

      {formAberto && (
        <Card className="border-primary/30">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={salvar} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{editando ? 'Editar cliente' : 'Cadastrar cliente'}</h2>
                <Button type="button" variant="ghost" size="icon" onClick={() => setFormAberto(false)} aria-label="Fechar formulário"><X className="size-4" /></Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campo('nome', 'Nome completo *', 'Nome do cliente', true)}
                {campo('telefone', 'Telefone / WhatsApp *', '(11) 99999-9999', true)}
                {campo('email', 'E-mail', 'cliente@exemplo.com')}
                {campo('cpfCnpj', 'CPF ou CNPJ', 'Documento para nota fiscal')}
                {campo('cep', 'CEP', '00000-000')}
                {campo('endereco', 'Endereço completo', 'Rua, número, bairro, cidade e UF')}
              </div>
              <p className="text-xs text-muted-foreground">
                O CPF/CNPJ e o endereço serão utilizados no futuro emissor fiscal. Nenhuma nota é emitida neste formulário.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setFormAberto(false)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-10" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone, CPF/CNPJ, e-mail ou pet" aria-label="Buscar clientes" />
      </div>

      {loading ? <SkeletonLoader type="cards" count={4} /> : filtrados.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <UserRound className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{busca ? 'Nenhum resultado para a busca.' : 'Nenhum cliente cadastrado.'}</p>
          {!busca && <Button className="mt-4" onClick={abrirNovo}>Cadastrar primeiro cliente</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtrados.map((cliente) => (
            <Card key={cliente.id} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-base break-words">{cliente.nome}</p>
                    <Badge variant="secondary" className="mt-1">{cliente._count?.vendas || 0} venda(s)</Badge>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => abrirEdicao(cliente)}><Edit3 className="mr-1.5 size-3.5" />Editar</Button>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2 break-all"><Phone className="size-4 shrink-0" />{cliente.telefone}</span>
                  {cliente.email && <span className="flex items-center gap-2 break-all"><Mail className="size-4 shrink-0" />{cliente.email}</span>}
                  {cliente.cpfCnpj && <span className="flex items-center gap-2"><UserRound className="size-4 shrink-0" />{cliente.cpfCnpj}</span>}
                  {cliente.endereco && <span className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{cliente.endereco}</span>}
                </div>
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Pets ({cliente.pets.length})</p>
                  <p className="mt-1 text-sm">{cliente.pets.length ? cliente.pets.map((pet) => pet.nome).join(' · ') : 'Nenhum pet cadastrado'}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
