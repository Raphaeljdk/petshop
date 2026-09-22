'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Dog, Trash2, Pencil, Phone, Mail, MapPin, Search, Filter, X, MapPinned } from 'lucide-react'
import { format, parseISO } from 'date-fns'
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
import { ExportButton } from '@/components/ui/ExportButton'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import type { Cliente, Pet } from '@/lib/types'
import { ZettaResourceTable } from '@/components/admin/ZettaResourceTable'
import { ZettaClientLinks } from '@/components/admin/ZettaClientLinks'

interface ClientesViewProps {
  onCountsChange?: (total: number) => void
}

export function ClientesView({ onCountsChange }: ClientesViewProps) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dataView, setDataView] = useState<'hub' | 'zetta_clientes' | 'zetta_pets'>('hub')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    cep: '',
  })
  const [petDialog, setPetDialog] = useState<{ clienteId: string; pet?: Pet } | null>(null)
  const [petForm, setPetForm] = useState<any>({})
  const [busca, setBusca] = useState('')
  const [filtroPets, setFiltroPets] = useState<string>('todos')
  const [confirmExcluir, setConfirmExcluir] = useState<
    | { tipo: 'cliente'; id: string; nome: string }
    | { tipo: 'pet'; id: string; nome: string }
    | null
  >(null)

  const carregar = async () => {
    try {
      const res = await fetch('/api/clientes', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setClientes(data)
        onCountsChange?.(data.length)
      }
    } catch (e) {
      console.error('clientes erro:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return clientes.filter((c) => {
      if (termo) {
        const nome = (c.nome || '').toLowerCase()
        const telefone = (c.telefone || '').toLowerCase()
        const email = (c.email || '').toLowerCase()
        if (
          !nome.includes(termo) &&
          !telefone.includes(termo) &&
          !email.includes(termo)
        ) {
          return false
        }
      }
      if (filtroPets === 'com_pets') {
        if (!c.pets || c.pets.length === 0) return false
      } else if (filtroPets === 'sem_pets') {
        if (c.pets && c.pets.length > 0) return false
      }
      return true
    })
  }, [clientes, busca, filtroPets])

  const temFiltrosAtivos = busca.trim() !== '' || filtroPets !== 'todos'

  const limparFiltros = () => {
    setBusca('')
    setFiltroPets('todos')
  }

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', telefone: '', email: '', endereco: '', cep: '' })
    setDialogOpen(true)
  }

  const abrirEdicao = (c: Cliente) => {
    setEditando(c)
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      email: c.email || '',
      endereco: c.endereco || '',
      cep: c.cep || '',
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!form.nome || !form.telefone) {
      toast.error('Preencha nome e telefone')
      return
    }
    try {
      const body = {
        nome: form.nome,
        telefone: form.telefone,
        email: form.email || null,
        endereco: form.endereco || null,
        cep: form.cep || null,
      }
      const url = editando ? `/api/clientes/${editando.id}` : '/api/clientes'
      const method = editando ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(editando ? 'Cliente atualizado' : 'Cliente criado')
      setDialogOpen(false)
      carregar()
    } catch {
      toast.error('Erro ao salvar cliente')
    }
  }

  const excluir = async (id: string) => {
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      toast.success('Cliente excluído')
      carregar()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const salvarPet = async () => {
    if (!petDialog) return
    const isEdit = !!petDialog.pet
    if (!petForm.nome || !petForm.especie) {
      toast.error('Preencha nome e espécie do pet')
      return
    }
    try {
      const url = isEdit ? `/api/pets/${petDialog.pet!.id}` : '/api/pets'
      const method = isEdit ? 'PUT' : 'POST'
      const body: any = {
        nome: petForm.nome,
        especie: petForm.especie,
        raca: petForm.raca || null,
        idade: petForm.idade || null,
        peso: petForm.peso || null,
        clienteId: petDialog.clienteId,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Pet atualizado' : 'Pet cadastrado')
      setPetDialog(null)
      setPetForm({})
      carregar()
    } catch {
      toast.error('Erro ao salvar pet')
    }
  }

  const excluirPet = async (petId: string) => {
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      toast.success('Pet excluído')
      carregar()
    } catch {
      toast.error('Erro ao excluir pet')
    }
  }

  const fonteTabs = (
    <div className="inline-flex flex-wrap gap-2 rounded-xl border bg-card p-1">
      <Button type="button" size="sm" variant={dataView === 'hub' ? 'default' : 'ghost'} onClick={() => setDataView('hub')}>
        Contas do Hub
      </Button>
      <Button type="button" size="sm" variant={dataView === 'zetta_clientes' ? 'default' : 'ghost'} onClick={() => setDataView('zetta_clientes')}>
        Clientes Zetta
      </Button>
      <Button type="button" size="sm" variant={dataView === 'zetta_pets' ? 'default' : 'ghost'} onClick={() => setDataView('zetta_pets')}>
        Pets Zetta
      </Button>
    </div>
  )

  if (dataView !== 'hub') {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clientes & Pets</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Dados separados por origem: Hub e ERP Zetta.
          </p>
        </div>
        {fonteTabs}
        {dataView === 'zetta_clientes' ? (
          <>
            <ZettaClientLinks />
            <ZettaResourceTable resource="clientes" title="Clientes do ERP Zetta" description="Cadastro oficial de clientes do ERP. Use o cliCod para vincular uma conta do portal à pessoa correta." />
          </>
        ) : (
          <ZettaResourceTable resource="animais" title="Pets do ERP Zetta" description="Animais oficiais do ERP, vinculados pelo cliCod do cliente." />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clientes & Pets</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro completo de clientes e seus pets
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton type="clientes" label="Exportar" variant="outline" className="h-9 sm:h-10" />
          <Button onClick={abrirNovo} className="h-9 sm:h-10">
            <Plus className="size-4" /> <span className="hidden sm:inline ml-1">Novo cliente</span>
            <span className="sm:hidden ml-1">Novo</span>
          </Button>
        </div>
      </div>

      {fonteTabs}

      {/* Filtros de busca */}
      <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
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
          <Select value={filtroPets} onValueChange={setFiltroPets}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <Filter className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Pets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              <SelectItem value="com_pets">Com pets</SelectItem>
              <SelectItem value="sem_pets">Sem pets</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltrosAtivos && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Mostrando {clientesFiltrados.length} de {clientes.length} cliente(s)
            </p>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-7 text-xs">
              <X className="size-3" /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <SkeletonLoader type="cards" count={6} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {!loading && clientesFiltrados.map((c) => (
          <Card key={c.id} className="card-hover">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="truncate">{c.nome}</span>
                  </CardTitle>
                  <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3 shrink-0" /> <span className="truncate">{c.telefone}</span>
                    </span>
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3 shrink-0" /> <span className="truncate">{c.email}</span>
                      </span>
                    )}
                    {c.endereco && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 shrink-0" /> <span className="truncate">{c.endereco}</span>
                      </span>
                    )}
                    {c.cep && (
                      <span className="flex items-center gap-1">
                        <MapPinned className="size-3 shrink-0" /> <span className="truncate">CEP: {c.cep}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEdicao(c)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setConfirmExcluir({ tipo: 'cliente', id: c.id, nome: c.nome })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Pets ({c.pets?.length || 0})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setPetDialog({ clienteId: c.id })
                    setPetForm({})
                  }}
                >
                  <Plus className="size-3" /> Pet
                </Button>
              </div>
              {c.pets && c.pets.length > 0 ? (
                <div className="space-y-1">
                  {c.pets.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/40 hover:bg-muted transition-colors gap-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                          <Dog className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.especie} {p.raca && `· ${p.raca}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => {
                            setPetDialog({ clienteId: c.id, pet: p })
                            setPetForm({
                              nome: p.nome,
                              especie: p.especie,
                              raca: p.raca || '',
                              idade: p.idade || '',
                              peso: p.peso || '',
                            })
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          onClick={() => setConfirmExcluir({ tipo: 'pet', id: p.id, nome: p.nome })}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhum pet cadastrado.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground pt-1">
                Cliente desde {format(parseISO(c.createdAt), 'MMM/yyyy', { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && clientesFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum cliente encontrado com os filtros aplicados.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editando ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Dados do cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="end">Endereço</Label>
              <Input id="end" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <MapPinned className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="cep"
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  value={form.cep}
                  onChange={(e) => {
                    const limpo = e.target.value.replace(/\D/g, '').slice(0, 8)
                    const formatado =
                      limpo.length <= 5
                        ? limpo
                        : `${limpo.slice(0, 5)}-${limpo.slice(5)}`
                    setForm({ ...form, cep: formatado })
                  }}
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Usado para calcular frete nas compras do cliente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvar} className="h-10 w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!petDialog} onOpenChange={(o) => !o && setPetDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Dog className="size-5 text-orange-600" />
              {petDialog?.pet ? 'Editar pet' : 'Cadastrar pet'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Dados do pet</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="petNome">Nome</Label>
              <Input id="petNome" value={petForm.nome || ''} onChange={(e) => setPetForm({ ...petForm, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="petEspecie">Espécie</Label>
              <Input id="petEspecie" placeholder="Cão, gato..." value={petForm.especie || ''} onChange={(e) => setPetForm({ ...petForm, especie: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="petRaca">Raça</Label>
              <Input id="petRaca" value={petForm.raca || ''} onChange={(e) => setPetForm({ ...petForm, raca: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="petIdade">Idade</Label>
              <Input id="petIdade" placeholder="2 anos" value={petForm.idade || ''} onChange={(e) => setPetForm({ ...petForm, idade: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="petPeso">Peso (kg)</Label>
              <Input id="petPeso" value={petForm.peso || ''} onChange={(e) => setPetForm({ ...petForm, peso: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvarPet} className="h-10 w-full sm:w-auto">Salvar pet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(o) => !o && setConfirmExcluir(null)}
        title={confirmExcluir?.tipo === 'cliente' ? 'Excluir cliente?' : 'Excluir pet?'}
        description={
          confirmExcluir?.tipo === 'cliente'
            ? `Todos os pets e vendas vinculados a "${confirmExcluir.nome}" serão afetados. Esta ação não pode ser desfeita.`
            : `Excluir o pet "${confirmExcluir?.nome}"? Esta ação não pode ser desfeita.`
        }
        confirmText="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmExcluir) return
          if (confirmExcluir.tipo === 'cliente') await excluir(confirmExcluir.id)
          else await excluirPet(confirmExcluir.id)
        }}
      />
    </div>
  )
}
