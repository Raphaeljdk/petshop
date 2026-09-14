'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Logo } from '@/components/brand/Logo'
import dynamic from 'next/dynamic'

const AdminPanel = dynamic(
  () => import('@/components/admin/AdminPanel').then((m) => m.default),
  { ssr: false }
)
const ClientPortal = dynamic(
  () => import('@/components/cliente-portal/ClientPortal').then((m) => m.ClientPortal),
  { ssr: false }
)

export default function Home() {
  const { sessao, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <Logo size="xl" animated />
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary animate-pulse" />
          <span className="size-2.5 rounded-full bg-cyan-500 animate-pulse [animation-delay:150ms]" />
          <span className="size-2.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  if (!sessao.autenticado) {
    return <AuthScreen />
  }

  if (sessao.user?.role === 'ADMIN') {
    return <AdminPanel />
  }

  return <ClientPortal />
}
