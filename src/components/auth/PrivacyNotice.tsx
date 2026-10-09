import { ArrowUpRight, ShieldCheck } from 'lucide-react'

export function PrivacyNotice() {
  return <aside aria-label="Privacidade e LGPD" className="rounded-2xl border border-teal-700/20 bg-teal-700/5 p-4 text-xs leading-relaxed">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-800 dark:text-teal-300" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">O cuidado também é com seus dados.</p>
        <p className="mt-1.5 text-muted-foreground">Usamos seus dados para identificar sua conta, organizar os cuidados do seu pet e atender seus pedidos. Pela LGPD, você pode solicitar acesso, correção e, quando aplicável, exclusão dos seus dados.</p>
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring dark:text-teal-300">
          Privacidade e seus direitos (LGPD)<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only"> — abre em nova aba</span>
        </a>
        <p className="text-muted-foreground">Acessar ou criar a conta não autoriza o envio de publicidade.</p>
      </div>
    </div>
  </aside>
}
