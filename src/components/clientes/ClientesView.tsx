'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Dog,
  Link2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { ZettaClientLinks } from '@/components/admin/ZettaClientLinks'
import { ClientInviteButton } from '@/components/admin/ClientInviteButton'
import { ClientInvitationHistory } from '@/components/admin/ClientInvitationHistory'
import { toast } from 'sonner'

type PortalAccount = {
  id: string
  nome: string
  email: string
  ativo: boolean
  siggmaCliCod: number | null
  clienteId: string | null
}

type ZettaPet = {
  id: number
  clienteId: number
  nome?: string | null
  especie?: string | null
  raca?: string | null
  sexo?: string | null
  peso?: number | string | null
  status?: string | null
}

type ZettaClient = {
  id: number
  nome?: string | null
  apelido?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  ativo?: boolean | null
  dataAtualizacao?: string | null
  pets: ZettaPet[]
  portal: PortalAccount | null
}

type UnifiedResponse = {
  success: boolean
  source: 'zetta'
  totalClientes: number
  totalPets: number
  contasPortal: number
  contasVinculadas: number
  clientes: ZettaClient[]
  error?: string
}

interface ClientesViewProps {
  onCountsChange?: (total: number) => void
}

const PAGE_SIZE = 24

export function ClientesView({ onCountsChange }: ClientesViewProps) {
  const [data, setData] = useState<UnifiedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'com_pets' | 'sem_pets' | 'vinculados'>('todos')
  const [pagina, setPagina] = useState(1)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/zetta/clientes-unificados', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || 'Não foi possível consultar clientes e pets do Zetta.')
        }
        if (!active) return
        setData(payload)
        onCountsChange?.(payload.totalClientes || 0)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Falha ao consultar o Zetta.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void carregar()
    return () => {
      active = false
    }
  }, [onCountsChange, refresh])

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (data?.clientes || []).filter((cliente) => {
      if (termo) {
        const campos = [
          cliente.nome,
          cliente.apelido,
          cliente.email,
          cliente.telefone,
          cliente.celular,
          String(cliente.id),
          ...cliente.pets.flatMap((pet) => [pet.nome, pet.especie, pet.raca]),
        ]
        if (!campos.some((value) => String(value || '').toLowerCase().includes(termo))) {
          return false
        }
      }

      if (filtro === 'com_pets' && cliente.pets.length === 0) return false
      if (filtro === 'sem_pets' && cliente.pets.length > 0) return false
      if (filtro === 'vinculados' && !cliente.portal) return false
      return true
    })
  }, [data, busca, filtro])

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / PAGE_SIZE))
  const clientesPagina = clientesFiltrados.slice(
    (pagina - 1) * PAGE_SIZE,
    pagina * PAGE_SIZE
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clientes & Pets</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            O Zetta é a fonte oficial. O Hub Matilha Prado organiza, consulta e vincula esses dados ao portal do cliente.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Zetta
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Uma única base de clientes</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Clientes e pets exibidos nesta tela vêm do Siggma/Zetta. As contas do Hub não duplicam o cadastro do ERP: elas servem apenas para autenticação e são ligadas ao cliente correto pelo <strong>cliCod</strong>. Alterações no cadastro oficial dependerão da API de escrita do Zetta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <UsersRound className="size-5 text-blue-600" />
            <p className="mt-3 text-2xl font-bold">{loading ? '—' : data?.totalClientes || 0}</p>
            <p className="text-xs text-muted-foreground">Clientes no Zetta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Dog className="size-5 text-orange-600" />
            <p className="mt-3 text-2xl font-bold">{loading ? '—' : data?.totalPets || 0}</p>
            <p className="text-xs text-muted-foreground">Pets no Zetta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <UserRound className="size-5 text-cyan-600" />
            <p className="mt-3 text-2xl font-bold">{loading ? '—' : data?.contasPortal || 0}</p>
            <p className="text-xs text-muted-foreground">Contas no portal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Link2 className="size-5 text-green-600" />
            <p className="mt-3 text-2xl font-bold">{loading ? '—' : data?.contasVinculadas || 0}</p>
            <p className="text-xs text-muted-foreground">Contas vinculadas</p>
          </CardContent>
        </Card>
      </div>

      <ZettaClientLinks />

      <div className="rounded-xl border bg-card/50 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => { setBusca(event.target.value); setPagina(1) }}
              placeholder="Buscar cliente, telefone, e-mail, cliCod ou pet..."
              className="pl-9"
            />
            {busca && (
              <button
                type="button"
                onClick={() => { setBusca(''); setPagina(1) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={filtro} onValueChange={(value) => { setFiltro(value as typeof filtro); setPagina(1) }}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              <SelectItem value="com_pets">Com pets</SelectItem>
              <SelectItem value="sem_pets">Sem pets</SelectItem>
              <SelectItem value="vinculados">Com acesso ao portal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mostrando {clientesFiltrados.length} de {data?.totalClientes || 0} cliente(s) oficiais.
        </p>
      </div>

      <ClientInvitationHistory />

      {loading ? (
        <SkeletonLoader type="cards" count={8} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clientesPagina.map((cliente) => (
            <Card key={cliente.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {cliente.nome || cliente.apelido || `Cliente #${cliente.id}`}
                    </CardTitle>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      cliCod {cliente.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={cliente.ativo === false ? 'secondary' : 'default'}>
                      {cliente.ativo === false ? 'Inativo' : 'Ativo'}
                    </Badge>
                    {cliente.portal && (
                      <Badge variant="outline" className="text-[10px]">
                        <CheckCircle2 className="size-3" /> Portal vinculado
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!cliente.portal && <ClientInviteButton id={cliente.id} nome={cliente.nome || `Cliente #${cliente.id}`} email={cliente.email || ''} disabled={cliente.ativo === false} />}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(cliente.celular || cliente.telefone) && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {cliente.celular || cliente.telefone}
                    </p>
                  )}
                  {cliente.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{cliente.email}</span>
                    </p>
                  )}
                  {cliente.portal && (
                    <p className="flex items-center gap-1.5 text-green-700">
                      <Link2 className="size-3.5 shrink-0" />
                      <span className="truncate">{cliente.portal.email}</span>
                    </p>
                  )}
                </div>

                <div className="border-t pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pets ({cliente.pets.length})
                    </p>
                    <Badge variant="secondary" className="text-[10px]">Fonte Zetta</Badge>
                  </div>

                  {cliente.pets.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Nenhum pet vinculado no ERP.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cliente.pets.slice(0, 5).map((pet) => (
                        <div key={pet.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{pet.nome || `Pet #${pet.id}`}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {pet.especie || 'Espécie não informada'}
                              {pet.raca ? ` · ${pet.raca}` : ''}
                              {pet.peso != null ? ` · ${pet.peso} kg` : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            #{pet.id}
                          </Badge>
                        </div>
                      ))}
                      {cliente.pets.length > 5 && (
                        <p className="text-[11px] text-muted-foreground">
                          + {cliente.pets.length - 5} pet(s) neste cliente
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && clientesPagina.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado com os filtros selecionados.
        </div>
      )}

      {!loading && clientesFiltrados.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Página {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((value) => Math.max(1, value - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((value) => Math.min(totalPaginas, value + 1))}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
