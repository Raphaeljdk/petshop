'use client'

import { CalendarClock, Heart, PawPrint, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { AccountForm, type AccountMode, type AccountRole } from './AccountForm'

export function AccountExperience(props: {
  initialMode?: AccountMode; initialRole?: AccountRole; onSuccess?: () => void; onBusyChange?: (busy: boolean) => void
}) {
  return <div className="account-experience">
    <aside className="account-story" aria-label="Matilha Prado">
      <Logo size="lg" variant="light" />
      <div className="relative z-10 my-10">
        <div className="account-paw mb-7 flex size-16 items-center justify-center rounded-2xl"><PawPrint className="size-8" /></div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Conectados pelo cuidado</p>
        <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight">Um só lugar.<br /><span className="text-orange-300">Todo o carinho.</span></h2>
        <p className="mt-5 max-w-xs text-sm leading-7 text-slate-300">Da rotina do seu pet à organização da nossa equipe. Cada acesso aproxima você da Matilha Prado.</p>
      </div>
      <div className="relative z-10 space-y-5 text-sm">
        <div className="flex items-center gap-3"><CalendarClock className="size-5 text-orange-300" /><span>Agendamentos à mão</span></div>
        <div className="flex items-center gap-3"><Heart className="size-5 text-orange-300" /><span>Cuidado em cada etapa</span></div>
        <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-orange-300" /><span>Um acesso para cada pessoa</span></div>
      </div>
      <p className="relative z-10 mt-auto pt-10 text-xs text-slate-400">Uma família cuidando da sua.</p>
      <PawPrint className="account-watermark" aria-hidden="true" />
    </aside>
    <AccountForm {...props} />
  </div>
}
