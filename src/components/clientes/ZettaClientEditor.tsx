'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type FormState = {
  cpfCnpj: string
  nome: string
  email: string
  telefone: string
  endereco: string
  cep: string
}

const emptyForm: FormState = {
  cpfCnpj: '',
  nome: '',
  email: '',
  telefone: '',
  endereco: '',
  cep: '',
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function ZettaClientEditor({
  cliCod,
  onSaved,
}: {
  cliCod?: number
  onSaved?: () => void
}) {
  const editing = Boolean(cliCod)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (!open) return

    if (!cliCod) {
      setForm(emptyForm)
      return
    }

    let active = true
    setLoading(true)

    fetch(`/api/admin/siggma/clientes?id=${cliCod}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Não foi possível consultar o cliente no Siggma.')
        }
        return payload
      })
      .then((payload) => {
        if (!active) return
        const client = payload.cliente || {}
        setForm({
          cpfCnpj: String(client.cpfCnpj || ''),
          nome: String(client.nome || ''),
          email: String(client.email || ''),
          telefone: String(client.telefone || ''),
          endereco: String(client.endereco || ''),
          cep: String(client.cep || ''),
        })
      })
      .catch((error) => {
        if (!active) return
        toast.error(error instanceof Error ? error.message : 'Falha ao carregar cliente.')
        setOpen(false)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, cliCod])

  function field(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function save() {
    const cpfCnpj = onlyDigits(form.cpfCnpj)
    if (!form.nome.trim() || !cpfCnpj) {
      toast.error('Informe nome e CPF/CNPJ.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/siggma/clientes', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(cliCod ? { cliCod } : {}),
          ...form,
          cpfCnpj,
          telefone: onlyDigits(form.telefone),
          cep: onlyDigits(form.cep),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'O Siggma não confirmou a gravação.')
      }

      toast.success(editing ? 'Cliente atualizado no Zetta.' : 'Cliente criado no Zetta.')
      setOpen(false)
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar no Zetta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        ) : (
          <Button type="button" className="gap-2">
            <Plus className="size-4" />
            Novo cliente
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar cliente no Zetta' : 'Novo cliente no Zetta'}</DialogTitle>
          <DialogDescription>
            A gravação é feita pela API oficial do Siggma/Zetta. O CPF/CNPJ identifica o cadastro no ERP.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium">Nome *</span>
              <Input
                value={form.nome}
                onChange={(event) => field('nome', event.target.value)}
                placeholder="Nome completo ou razão social"
                autoComplete="name"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">CPF/CNPJ *</span>
              <Input
                value={form.cpfCnpj}
                onChange={(event) => field('cpfCnpj', event.target.value)}
                placeholder="Somente números"
                inputMode="numeric"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">Telefone</span>
              <Input
                value={form.telefone}
                onChange={(event) => field('telefone', event.target.value)}
                placeholder="DDD + número"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium">E-mail</span>
              <Input
                value={form.email}
                onChange={(event) => field('email', event.target.value)}
                placeholder="cliente@email.com"
                type="email"
                autoComplete="email"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium">Endereço</span>
              <Input
                value={form.endereco}
                onChange={(event) => field('endereco', event.target.value)}
                placeholder="Rua / avenida"
                autoComplete="street-address"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">CEP</span>
              <Input
                value={form.cep}
                onChange={(event) => field('cep', event.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={loading || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Salvando...' : editing ? 'Salvar no Zetta' : 'Criar no Zetta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
