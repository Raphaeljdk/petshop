'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type PortalUser = {
  id: string
  nome: string
  email: string
  clienteId: string | null
  siggmaCliCod: number | null
  ativo: boolean
}

export function ZettaClientLinks() {
  const [users, setUsers] = useState<PortalUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [cliCod, setCliCod] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/zetta/vinculos', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível carregar as contas do portal.')
      }
      setUsers(data.users || [])
      setSelectedUserId((current) => current || data.users?.[0]?.id || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar vínculos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  )

  useEffect(() => {
    setCliCod(selected?.siggmaCliCod ? String(selected.siggmaCliCod) : '')
  }, [selected])

  const save = async (nextCliCod: number | null) => {
    if (!selectedUserId) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/zetta/vinculos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: selectedUserId,
          siggmaCliCod: nextCliCod,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível atualizar o vínculo.')
      }
      toast.success(nextCliCod ? 'Conta vinculada ao cliente do Zetta.' : 'Vínculo removido.')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar vínculo.')
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = Number.parseInt(cliCod, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error('Informe um cliCod válido.')
      return
    }
    await save(parsed)
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4 text-primary" />
              Vínculo conta do portal ↔ cliente Zetta
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Vincule manualmente uma conta CLIENTE ao cliCod oficial do ERP. Depois disso, o portal passa a mostrar os pets e o histórico desse cliente.
            </p>
          </div>
          <Badge variant="outline">
            {users.filter((user) => user.siggmaCliCod).length} vinculada(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando contas...
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não existem contas CLIENTE no Hub.</p>
        ) : (
          <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto_auto] lg:items-end">
            <div className="space-y-1.5">
              <label htmlFor="portal-user" className="text-xs font-medium text-muted-foreground">
                Conta do portal
              </label>
              <select
                id="portal-user"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome} — {user.email}{user.siggmaCliCod ? ` — cliCod ${user.siggmaCliCod}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="siggma-cli-cod" className="text-xs font-medium text-muted-foreground">
                cliCod do Zetta
              </label>
              <Input
                id="siggma-cli-cod"
                inputMode="numeric"
                value={cliCod}
                onChange={(event) => setCliCod(event.target.value.replace(/\D/g, ''))}
                placeholder="Ex.: 42"
              />
            </div>

            <Button type="submit" disabled={saving || !selectedUserId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Vincular
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={saving || !selected?.siggmaCliCod}
              onClick={() => void save(null)}
            >
              <Unlink className="size-4" /> Remover
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
