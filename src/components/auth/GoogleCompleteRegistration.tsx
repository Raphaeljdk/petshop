'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Loader2, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatCep, formatCpfCnpj, formatPhone } from '@/lib/auth-validation'
import { PrivacyNotice } from './PrivacyNotice'

export function GoogleCompleteRegistration() {
  const { refresh } = useAuth()
  const [profile, setProfile] = useState<{ nome: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [data, setData] = useState({ telefone: '', cpfCnpj: '', endereco: '', cep: '' })

  useEffect(() => {
    let alive = true
    fetch('/api/auth/google/pending', { cache: 'no-store' })
      .then(async res => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Seu acesso Google expirou.')
        return payload as { nome: string; email: string }
      })
      .then(payload => { if (alive) setProfile({ nome: payload.nome, email: payload.email }) })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  function update(name: keyof typeof data, value: string) {
    setData(previous => ({ ...previous, [name]: value }))
    setFields(previous => ({ ...previous, [name]: '' }))
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !profile) return
    setBusy(true); setError(''); setFields({})
    try {
      const res = await fetch('/api/auth/google/register', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        setFields(payload?.fields || {})
        throw new Error(payload?.error || 'Não foi possível finalizar seu cadastro.')
      }
      await refresh()
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-dvh bg-muted/30 px-4 py-10">
    <div className="mx-auto w-full max-w-lg rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <Logo size="sm" />
      <div className="my-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <PawPrint className="size-4" /> Espaço do cliente
        </p>
        <h1 className="text-2xl font-bold">Só mais alguns dados!</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Seu e-mail já foi verificado pelo Google. Informe os dados necessários para seus agendamentos e pedidos.
        </p>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Confirmando sua conta...</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {profile && <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="google-name" className="mb-1.5 block text-sm font-medium">Nome</label>
          <Input id="google-name" value={profile.nome} readOnly className="h-11 bg-muted/50" />
        </div>
        <div>
          <label htmlFor="google-email" className="mb-1.5 block text-sm font-medium">E-mail verificado</label>
          <Input id="google-email" value={profile.email} readOnly className="h-11 bg-muted/50" />
        </div>
        <div>
          <label htmlFor="google-phone" className="mb-1.5 block text-sm font-medium">Telefone com DDD *</label>
          <Input id="google-phone" type="tel" autoComplete="tel-national" required className="h-11"
            value={data.telefone} onChange={e => update('telefone', formatPhone(e.target.value))}
            aria-invalid={!!fields.telefone} aria-describedby={fields.telefone ? 'google-phone-error' : undefined}
            placeholder="(11) 99999-9999" />
          {fields.telefone && <p id="google-phone-error" className="mt-1 text-xs text-destructive">{fields.telefone}</p>}
        </div>
        <div>
          <label htmlFor="google-document" className="mb-1.5 block text-sm font-medium">CPF ou CNPJ *</label>
          <Input id="google-document" inputMode="numeric" required className="h-11"
            value={data.cpfCnpj} onChange={e => update('cpfCnpj', formatCpfCnpj(e.target.value))}
            aria-invalid={!!fields.cpfCnpj} aria-describedby={fields.cpfCnpj ? 'google-document-error' : undefined}
            placeholder="000.000.000-00" />
          {fields.cpfCnpj && <p id="google-document-error" className="mt-1 text-xs text-destructive">{fields.cpfCnpj}</p>}
        </div>
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">Adicionar endereço (opcional)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="google-address" className="mb-1 block text-xs">Endereço</label>
              <Input id="google-address" autoComplete="street-address" value={data.endereco} onChange={e => update('endereco', e.target.value)} maxLength={240} />
            </div>
            <div>
              <label htmlFor="google-zip" className="mb-1 block text-xs">CEP</label>
              <Input id="google-zip" autoComplete="postal-code" inputMode="numeric" value={data.cep} onChange={e => update('cep', formatCep(e.target.value))} />
              {fields.cep && <p className="mt-1 text-xs text-destructive">{fields.cep}</p>}
            </div>
          </div>
        </details>
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
          {busy ? <><Loader2 className="size-4 animate-spin" /> Finalizando...</> : 'Concluir meu cadastro'}
        </Button>
      </form>}
      <div className="mt-5">
        <PrivacyNotice />
        <Link className="mt-4 inline-flex text-sm text-primary underline" href="/login">Voltar ao login</Link>
      </div>
    </div>
  </main>
}
