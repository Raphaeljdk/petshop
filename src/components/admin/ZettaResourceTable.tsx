'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'

export type ZettaResource = 'clientes' | 'animais' | 'produtos' | 'atendimentos'

type ResponseData = {
  success: boolean
  page: number
  limit: number
  total: number
  data: Array<Record<string, unknown>>
  error?: string
}

function text(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function money(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number)
    ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—'
}

function dateTime(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString('pt-BR')
}

function Table({ resource, rows }: { resource: ZettaResource; rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
  }

  if (resource === 'clientes') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Nome</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={text(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono text-xs">{text(row.id)}</td>
                <td className="px-3 py-3 font-medium">{text(row.nome)}</td>
                <td className="px-3 py-3">{text(row.celular || row.telefone)}</td>
                <td className="px-3 py-3">{text(row.email)}</td>
                <td className="px-3 py-3"><Badge variant={row.ativo === false ? 'secondary' : 'default'}>{row.ativo === false ? 'Inativo' : 'Ativo'}</Badge></td>
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
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-3">ID</th><th className="px-3 py-3">Pet</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Espécie / raça</th><th className="px-3 py-3">Sexo</th><th className="px-3 py-3">Peso</th><th className="px-3 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={text(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono text-xs">{text(row.id)}</td>
                <td className="px-3 py-3 font-medium">{text(row.nome)}</td>
                <td className="px-3 py-3 font-mono text-xs">{text(row.clienteId)}</td>
                <td className="px-3 py-3">{text(row.especie)}{row.raca ? ` · ${text(row.raca)}` : ''}</td>
                <td className="px-3 py-3">{text(row.sexo)}</td>
                <td className="px-3 py-3">{row.peso == null ? '—' : `${text(row.peso)} kg`}</td>
                <td className="px-3 py-3"><Badge variant="secondary">{text(row.status, 'Sem status')}</Badge></td>
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
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Marca</th><th className="px-3 py-3">Preço</th><th className="px-3 py-3">Estoque</th><th className="px-3 py-3">GTIN / barras</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={text(row.id)} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-mono text-xs">{text(row.id)}</td>
                <td className="px-3 py-3 font-medium">{text(row.nome)}</td>
                <td className="px-3 py-3">{text(row.marca)}</td>
                <td className="px-3 py-3 font-semibold">{money(row.preco)}</td>
                <td className="px-3 py-3">{Math.max(0, Number(row.estoqueReal) || 0)}</td>
                <td className="px-3 py-3 font-mono text-xs">{text(row.gtin || row.codigoBarras)}</td>
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
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-3">ID</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Itens</th><th className="px-3 py-3">Total</th></tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={text(row.id)} className="hover:bg-muted/40">
              <td className="px-3 py-3 font-mono text-xs">{text(row.id)}</td>
              <td className="px-3 py-3 font-mono text-xs">{text(row.clienteId)}</td>
              <td className="px-3 py-3">{dateTime(row.datahora)}</td>
              <td className="px-3 py-3"><Badge variant="secondary">{text(row.status)}</Badge></td>
              <td className="px-3 py-3">{text(row.totalItens, '0')}</td>
              <td className="px-3 py-3 font-semibold">{money(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ZettaResourceTable({
  resource,
  title,
  description,
}: {
  resource: ZettaResource
  title: string
  description?: string
}) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<ResponseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchable = resource === 'clientes' || resource === 'produtos'

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
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Não foi possível consultar o ERP.')
      }
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível consultar o ERP.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [resource, page, appliedQuery, searchable, refresh])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 25))),
    [data]
  )

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {description || 'Dados oficiais do ERP Zetta em modo somente leitura.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {searchable && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setAppliedQuery(query.trim())
              }}
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="w-52 pl-9" placeholder="Buscar..." />
              </div>
              <Button type="submit" variant="secondary">Buscar</Button>
            </form>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5"><SkeletonLoader type="table" count={6} /></div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        ) : (
          <Table resource={resource} rows={data?.data || []} />
        )}
      </CardContent>
      <div className="flex items-center justify-between border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">{data?.total || 0} registro(s) · página {data?.page || page} de {totalPages}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" />Anterior</Button>
          <Button size="sm" variant="outline" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>Próxima<ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </Card>
  )
}
