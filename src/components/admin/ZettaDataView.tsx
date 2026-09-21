'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Package,
  PawPrint,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'

type Resource = 'clientes' | 'animais' | 'produtos' | 'atendimentos'

type BridgeResponse = {
  success: boolean
  source: string
  resource: Resource
  ok: boolean
  page: number
  limit: number
  total: number
  data: Array<Record<string, unknown>>
  error?: string
}

const resources: Array<{
  id: Resource
  label: string
  icon: typeof Database
}> = [
  { id: 'clientes', label: 'Clientes', icon: UsersRound },
  { id: 'animais', label: 'Animais', icon: PawPrint },
  { id: 'produtos', label: 'Produtos', icon: Package },
  { id: 'atendimentos', label: 'Atendimentos', icon: ClipboardList },
]

function textValue(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: unknown) {
  return numberValue(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dateTime(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return textValue(value)
  return date.toLocaleString('pt-BR')
}

function DataTable({ resource, rows }: { resource: Resource; rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum registro encontrado.
      </div>
    )
  }

  if (resource === 'clientes') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Nome</th>
              <th className="px-3 py-3">Contato</th>
              <th className="px-3 py-3">E-mail</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Atualização</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={textValue(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono text-xs">{textValue(row.id)}</td>
                <td className="px-3 py-3 font-medium">{textValue(row.nome)}</td>
                <td className="px-3 py-3">{textValue(row.celular || row.telefone)}</td>
                <td className="px-3 py-3">{textValue(row.email)}</td>
                <td className="px-3 py-3">
                  <Badge variant={row.ativo === false ? 'secondary' : 'default'}>
                    {row.ativo === false ? 'Inativo' : 'Ativo'}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{dateTime(row.dataAtualizacao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (resource === 'animais') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">ID</th>
              <th className="px-3 py-3">Pet</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Espécie / raça</th>
              <th className="px-3 py-3">Sexo</th>
              <th className="px-3 py-3">Peso</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={textValue(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono text-xs">{textValue(row.id)}</td>
                <td className="px-3 py-3 font-medium">{textValue(row.nome)}</td>
                <td className="px-3 py-3 font-mono text-xs">{textValue(row.clienteId)}</td>
                <td className="px-3 py-3">
                  {textValue(row.especie)}{row.raca ? ` · ${textValue(row.raca)}` : ''}
                </td>
                <td className="px-3 py-3">{textValue(row.sexo)}</td>
                <td className="px-3 py-3">{row.peso == null ? '—' : `${textValue(row.peso)} kg`}</td>
                <td className="px-3 py-3">
                  <Badge variant="secondary">{textValue(row.status, 'Sem status')}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (resource === 'produtos') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Produto</th>
              <th className="px-3 py-3">Marca</th>
              <th className="px-3 py-3">Preço</th>
              <th className="px-3 py-3">Estoque</th>
              <th className="px-3 py-3">GTIN / barras</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={textValue(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3">
                  <div className="font-mono text-xs">{textValue(row.id)}</div>
                  {row.codigo && <div className="text-xs text-muted-foreground">{textValue(row.codigo)}</div>}
                </td>
                <td className="px-3 py-3 font-medium">{textValue(row.nome)}</td>
                <td className="px-3 py-3">{textValue(row.marca)}</td>
                <td className="px-3 py-3 font-semibold">{money(row.preco)}</td>
                <td className="px-3 py-3">
                  <Badge variant={numberValue(row.estoqueReal) > 0 ? 'default' : 'secondary'}>
                    {numberValue(row.estoqueReal)}
                  </Badge>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{textValue(row.gtin || row.codigoBarras)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-3">ID</th>
            <th className="px-3 py-3">Cliente</th>
            <th className="px-3 py-3">Data</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Itens</th>
            <th className="px-3 py-3">Total</th>
            <th className="px-3 py-3">Filial</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={textValue(row.id)} className="hover:bg-muted/40">
              <td className="px-3 py-3 font-mono text-xs">{textValue(row.id)}</td>
              <td className="px-3 py-3 font-mono text-xs">{textValue(row.clienteId)}</td>
              <td className="px-3 py-3">{dateTime(row.datahora)}</td>
              <td className="px-3 py-3"><Badge variant="secondary">{textValue(row.status)}</Badge></td>
              <td className="px-3 py-3">{textValue(row.totalItens, '0')}</td>
              <td className="px-3 py-3 font-semibold">{money(row.total)}</td>
              <td className="px-3 py-3">{textValue(row.filial)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ZettaDataView() {
  const [resource, setResource] = useState<Resource>('produtos')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [response, setResponse] = useState<BridgeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [totals, setTotals] = useState<Partial<Record<Resource, number>>>({})

  const searchable = resource === 'clientes' || resource === 'produtos'

  useEffect(() => {
    let active = true
    const loadTotals = async () => {
      const entries = await Promise.all(
        resources.map(async ({ id }) => {
          try {
            const res = await fetch(`/api/admin/zetta/dados?recurso=${id}&limit=1`, {
              credentials: 'same-origin',
              cache: 'no-store',
            })
            const data = await res.json()
            return [id, res.ok ? Number(data.total || 0) : 0] as const
          } catch {
            return [id, 0] as const
          }
        })
      )
      if (active) setTotals(Object.fromEntries(entries) as Partial<Record<Resource, number>>)
    }
    void loadTotals()
    return () => { active = false }
  }, [refresh])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        recurso: resource,
        page: String(page),
        limit: '25',
      })
      if (searchable && appliedQuery) params.set('q', appliedQuery)

      const res = await fetch(`/api/admin/zetta/dados?${params.toString()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Não foi possível consultar o ERP.')
      }
      setResponse(data)
    } catch (e) {
      setResponse(null)
      setError(e instanceof Error ? e.message : 'Não foi possível consultar o ERP.')
    } finally {
      setLoading(false)
    }
  }, [resource, page, appliedQuery, searchable, refresh])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((response?.total || 0) / (response?.limit || 25))),
    [response]
  )

  const changeResource = (next: Resource) => {
    setResource(next)
    setPage(1)
    setQuery('')
    setAppliedQuery('')
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setAppliedQuery(query.trim())
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="size-5 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ERP Zetta</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Dados reais do Siggma/Zetta via bridge Oracle, em modo somente leitura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Fonte: PostgreSQL Zetta</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resources.map((item) => {
          const Icon = item.icon
          const active = resource === item.id
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => changeResource(item.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-5 text-muted-foreground" />
                <Badge variant={active ? 'default' : 'secondary'}>
                  {totals[item.id] ?? '—'}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-semibold">{item.label}</p>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {resources.find((item) => item.id === resource)?.label}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {response ? `${response.total} registro(s) encontrado(s)` : 'Consultando ERP...'}
            </p>
          </div>

          {searchable && (
            <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={resource === 'produtos' ? 'Buscar produto...' : 'Buscar cliente...'}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">Buscar</Button>
            </form>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 sm:p-6">
              <SkeletonLoader type="table" count={6} />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="font-medium text-destructive">Falha ao consultar o ERP</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => setRefresh((value) => value + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <DataTable resource={resource} rows={response?.data || []} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Página {response?.page || page} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Próxima <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O Hub não grava diretamente no banco do ERP. Alterações e movimentações continuam separadas para preservar as regras de negócio do Siggma.
      </p>
    </div>
  )
}
