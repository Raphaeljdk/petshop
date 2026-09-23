'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/brand/Logo'

export function ActivateClientAccount() {
  const token = useRef('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let active = true
    if (!token.current) token.current = new URLSearchParams(window.location.hash.slice(1)).get('convite') || ''
    window.history.replaceState(null, '', window.location.pathname)
    async function verify() {
      try {
        if (!/^[a-f0-9]{64}$/.test(token.current)) throw new Error('Abra o link completo recebido por e-mail. Se necessário, solicite um novo convite à loja.')
        const res = await fetch('/api/auth/convite-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', token: token.current }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Não foi possível verificar o convite.')
        if (active) setEmail(data.email)
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível verificar seu convite. Reabra o link do e-mail para tentar novamente.') }
      finally { if (active) setLoading(false) }
    }
    void verify()
    return () => { active = false }
  }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (senha !== confirmation) { setError('As senhas não coincidem.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/convite-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', token: token.current, senha, confirmarSenha: confirmation }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível ativar sua conta.')
      token.current = ''; setSenha(''); setConfirmation(''); setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar a ativação. Tente entrar antes de repetir.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-dvh flex items-center justify-center bg-muted/30 p-4 sm:p-8"><Card className="w-full max-w-lg"><CardContent className="p-6 sm:p-8 space-y-5">
    <Logo size="sm" />
    <div><h1 className="text-2xl font-bold">{done ? 'Seu acesso está pronto!' : 'Bem-vindo à Matilha Prado'}</h1><p className="mt-2 text-sm text-muted-foreground">{done ? 'E-mail confirmado. Entre com sua nova senha para acompanhar seus pets.' : 'Confirme seu e-mail definindo uma senha para o portal do cliente.'}</p></div>
    {loading && <p role="status">Verificando seu convite...</p>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {done ? <Button asChild className="w-full h-12"><Link href="/login">Entrar no portal</Link></Button> : email && <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="invite-email">E-mail do seu cadastro</Label><Input id="invite-email" value={email} readOnly autoComplete="username" className="mt-2 h-11 text-base" /></div>
      <div><Label htmlFor="invite-password">Crie sua senha</Label><Input id="invite-password" type={visible ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={10} maxLength={72} autoComplete="new-password" aria-describedby="invite-password-hint" className="mt-2 h-11 text-base" /><p id="invite-password-hint" className="mt-2 text-xs text-muted-foreground">Use pelo menos 10 caracteres, com letra e número. Limite de 72 bytes.</p></div>
      <div><Label htmlFor="invite-confirm">Repita sua senha</Label><Input id="invite-confirm" type={visible ? 'text' : 'password'} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required maxLength={72} autoComplete="new-password" className="mt-2 h-11 text-base" /></div>
      <Button type="button" variant="ghost" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar senhas' : 'Mostrar senhas'}</Button>
      <Button type="submit" disabled={busy} className="w-full h-12 btn-brand">{busy ? 'Ativando...' : 'Confirmar e-mail e ativar minha conta'}</Button>
    </form>}
    {!done && <p className="text-sm text-muted-foreground">Já possui acesso? <Link className="underline" href="/login">Entre na sua conta</Link>.</p>}
  </CardContent></Card></main>
}
