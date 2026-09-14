'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, Loader2, Mail, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { emailSchema } from '@/lib/auth-validation'

interface Invitation { id: string; email: string; expiresAt: string; usedAt: string | null; revokedAt: string | null; createdAt: string }
interface IssuedCode { email: string; code: string; expiresAt: string }

function statusOf(invitation: Invitation) {
  if (invitation.usedAt) return 'Utilizado'
  if (invitation.revokedAt) return 'Revogado'
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return 'Expirado'
  return 'Pendente'
}
const date = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function AdminInvitations() {
  const [items, setItems] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [issued, setIssued] = useState<IssuedCode | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/convites', { cache: 'no-store', credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os convites.')
      setItems(data.invitations)
    } catch (error) { setError(error instanceof Error ? error.message : 'Falha ao carregar os convites.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) { setError('Informe um e-mail válido.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    setCopied(false)
    try {
      const res = await fetch('/api/admin/convites', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: parsed.data }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o convite.')
      setIssued({ email: data.invitation.email, expiresAt: data.invitation.expiresAt, code: data.code })
      setEmail('')
      await load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível gerar o convite.') }
    finally { setBusy(false) }
  }
  async function revoke(id: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/convites?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível revogar o convite.')
      setRevoking(null)
      setIssued(null)
      setNotice('Convite revogado. O código não pode mais ser usado.')
      await load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Falha ao revogar.') }
    finally { setBusy(false) }
  }
  async function copy() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText('Cadastro de administrador — Matilha Prado\n' + window.location.origin + '/cadastro/administrador\nE-mail: ' + issued.email + '\nCódigo: ' + issued.code + '\nVálido até: ' + date(issued.expiresAt))
      setCopied(true)
    } catch { setError('Não foi possível copiar automaticamente. Selecione e copie o código abaixo.') }
  }

  return <section className="mx-auto max-w-4xl space-y-6">
    <div>
      <p className="eyebrow mb-3 text-primary">Gerenciamento de acesso</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipe e convites</h1>
      <p className="mt-2 text-sm text-muted-foreground">Autorize um novo administrador com um convite individual.</p>
    </div>
    {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800 dark:bg-teal-950 dark:text-teal-200">{notice}</p>}
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-xl bg-muted p-3 text-primary"><ShieldCheck className="size-5" /></span>
        <div><h2 className="font-semibold">Novo administrador</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">O convite dá acesso à gestão de clientes, agenda, vendas e configurações. Ele expira em 48 horas.</p></div>
      </div>
      <form onSubmit={create} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1"><label htmlFor="invite-email" className="mb-2 block text-sm font-medium">E-mail do administrador</label>
          <div className="relative"><Mail className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="invite-email" name="email" type="email" required maxLength={254} value={email}
            disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="pessoa@exemplo.com" className="h-10 pl-10" /></div>
        </div>
        <Button type="submit" disabled={busy || !!issued} className="h-10">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Gerar convite</Button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Ao gerar outro convite para o mesmo e-mail, o anterior é revogado.</p>
    </div>
    {issued && <div className="rounded-2xl border border-teal-600/30 bg-teal-50 p-5 dark:bg-teal-950/30">
      <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" />Convite pronto</h2>
      <p className="my-3 break-words text-sm">Para <strong>{issued.email}</strong>. Válido até {date(issued.expiresAt)}.</p>
      <label htmlFor="invite-code" className="sr-only">Código gerado</label>
      <Input id="invite-code" readOnly value={issued.code} onFocus={e => e.target.select()} className="bg-card font-mono text-sm" />
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Copie agora e compartilhe em particular com a pessoa autorizada. O código não será exibido novamente ao sair desta tela.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={copy} variant="outline">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Convite copiado' : 'Copiar convite'}</Button>
        <Button type="button" variant="ghost" onClick={() => { setIssued(null); setCopied(false) }}>Já salvei o convite</Button>
      </div>
    </div>}
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Convites recentes</h2>
        <Button type="button" variant="ghost" size="sm" disabled={loading || busy} onClick={() => { setError(''); void load() }}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />Atualizar</Button>
      </div>
      {loading && !items.length ? <p role="status" className="py-6 text-sm text-muted-foreground">Carregando convites...</p>
        : !items.length ? <div className="rounded-xl border border-dashed p-8 text-center"><Mail className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="text-sm font-medium">Nenhum convite por aqui.</p><p className="mt-1 text-sm text-muted-foreground">Gere o primeiro usando o e-mail da pessoa acima.</p></div>
        : <ul className="divide-y">{items.map(item => {
          const status = statusOf(item)
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0"><p className="break-all text-sm font-medium">{item.email}</p><p className="mt-1 text-xs text-muted-foreground">Validade: {date(item.expiresAt)}</p></div>
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-muted px-3 py-1 text-xs">{status}</span>
              {status === 'Pendente' && (revoking === item.id
                ? <div className="flex items-center gap-2"><Button size="sm" variant="destructive" disabled={busy} onClick={() => void revoke(item.id)}>Confirmar revogação</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setRevoking(null)} aria-label="Cancelar revogação"><X className="size-4" /></Button></div>
                : <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRevoking(item.id)}>Revogar</Button>)}
            </div>
          </li>
        })}</ul>}
    </div>
  </section>
}
