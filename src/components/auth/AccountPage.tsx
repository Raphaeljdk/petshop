'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Logo } from '@/components/brand/Logo'
import { AccountExperience } from './AccountExperience'
import type { AccountMode, AccountRole } from './AccountForm'

export function AccountPage({ mode, role = 'CLIENTE' }: { mode: AccountMode; role?: AccountRole }) {
  const { sessao, loading } = useAuth()
  const router = useRouter()
  useEffect(() => { if (!loading && sessao.autenticado) router.replace('/') }, [loading, sessao.autenticado, router])
  return <main className="account-page min-h-dvh px-4 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto mb-6 flex w-full max-w-[1040px] items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Voltar ao site</Link>
      <div className="md:hidden"><Logo size="sm" withText={false} /></div>
      <p className="hidden text-xs font-medium text-muted-foreground sm:block">Matilha Prado · Acesso à sua conta</p>
    </div>
    {loading || sessao.autenticado
      ? <div role="status" className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Carregando seu acesso...</div>
      : <div className="account-page-card mx-auto w-full max-w-[1040px]"><AccountExperience initialMode={mode} initialRole={role} /></div>}
    <p className="mx-auto mt-6 text-center text-xs text-muted-foreground">Matilha Prado · Uma família cuidando da sua.</p>
  </main>
}
