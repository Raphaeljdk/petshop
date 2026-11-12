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
      <main className="landing-boot-screen" role="status" aria-live="polite" aria-label="Abrindo Matilha Prado">
        <div className="landing-boot-glow" aria-hidden="true" />
        <div className="landing-boot-content">
          <Logo size="xl" animated />
          <p className="mt-5 text-sm font-semibold text-[#17374f]">Preparando sua experiência...</p>
          <p className="mt-1 text-xs text-[#637987]">Matilha Prado</p>
          <div className="landing-boot-progress mt-5" aria-hidden="true"><span /></div>
        </div>
      </main>
    )
  }

  if (!sessao.autenticado) {
    return <AuthScreen />
  }

  if (sessao.user?.role === 'ADMIN' || sessao.user?.role === 'KANBAN') {
    return <AdminPanel />
  }

  return <ClientPortal />
}
