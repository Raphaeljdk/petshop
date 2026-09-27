'use client'

import Image from 'next/image'
import { Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstall } from './InstallProvider'
import { cn } from '@/lib/utils'

export function InstallAppCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { installed, ready, openInstall } = useInstall()
  if (!ready || installed) return null

  return (
    <section aria-label="Atalho da Matilha Prado" className={cn('install-card', compact && 'install-card-compact', className)}>
      <div className="install-card-icon">
        <Image src="/icons/matilha-192.png" alt="Logo da Matilha Prado" width={88} height={88} className="rounded-2xl bg-white" />
      </div>
      <div className="min-w-0 flex-1">
        {!compact && <p className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-100"><Smartphone className="size-4" /> Sempre por perto</p>}
        <h2 className={cn('font-bold tracking-tight text-white', compact ? 'text-lg' : 'text-2xl sm:text-3xl')}>A Matilha Prado na sua tela inicial.</h2>
        <p className={cn('mt-2 max-w-xl leading-relaxed text-slate-200', compact ? 'text-sm' : 'text-base')}>Adicione nosso atalho e acesse o sistema pela logo, direto do seu celular ou computador.</p>
      </div>
      <Button size="lg" onClick={openInstall} className="install-card-button bg-orange-300 text-slate-950 hover:bg-orange-200">
        <Download className="size-4" /> Adicionar à tela inicial
      </Button>
    </section>
  )
}
