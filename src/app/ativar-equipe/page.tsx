'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { ANDRE_OPERATIONS_EMAIL } from '@/lib/operational-access'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AtivarEquipePage() {
  const { cadastrar } = useAuth()
  const router = useRouter()
  const [nome, setNome] = useState('André')
  const [email, setEmail] = useState(ANDRE_OPERATIONS_EMAIL)
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [convite, setConvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (email.trim().toLowerCase() !== ANDRE_OPERATIONS_EMAIL) {
      setError('Este formulário é exclusivo para o convite do André.')
      return
    }
    setBusy(true)
    try {
      await cadastrar({ nome, email, senha, confirmarSenha, convite, role: 'ADMIN' })
      // O servidor transforma o convite individual do André em conta KANBAN,
      // nunca em administrador.
      router.replace('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível ativar a conta.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-dvh bg-background px-4 py-12">
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Ativar acesso operacional</h1>
        <p className="mt-2 text-sm text-muted-foreground">Matilha Prado · Kanban, agendamento de banhos, consulta da agenda e endereços de entregas. Este acesso não é administrativo.</p>
      </div>
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm font-medium">Nome<Input className="mt-1" required minLength={3} value={nome} onChange={e=>setNome(e.target.value)} /></label>
        <label className="block text-sm font-medium">E-mail<Input className="mt-1" required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label className="block text-sm font-medium">Senha (mínimo 10 caracteres, letra e número)<Input className="mt-1" required type="password" autoComplete="new-password" minLength={10} value={senha} onChange={e=>setSenha(e.target.value)} /></label>
        <label className="block text-sm font-medium">Confirmar senha<Input className="mt-1" required type="password" autoComplete="new-password" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} /></label>
        <label className="block text-sm font-medium">Código do convite (64 caracteres)<Input className="mt-1 font-mono" required minLength={64} maxLength={64} value={convite} onChange={e=>setConvite(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Ativando...' : 'Ativar minha conta'}</Button>
      </form>
      <Link href="/login" className="block text-center text-sm text-primary hover:underline">Já tenho acesso · entrar</Link>
    </div>
  </main>
}
