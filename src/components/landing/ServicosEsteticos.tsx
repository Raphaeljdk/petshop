import { MessageCircle, PawPrint, Scissors, Sparkles } from 'lucide-react'
import { SERVICOS_ESTETICOS_MATILHA } from '@/lib/agenda-servicos'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

/** Vitrine informativa: não configura preço, pagamento ou reserva automática. */
export function ServicosEsteticos() {
  return (
    <section id="servicos" aria-labelledby="servicos-titulo" className="scroll-mt-24 border-y border-border bg-muted/30 py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary"><PawPrint className="size-4" /> Cuidado estético</p>
          <h2 id="servicos-titulo" className="text-2xl font-bold tracking-tight sm:text-3xl">Banho, tosa e cuidados para seu pet</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            A Matilha Prado realiza cuidados estéticos, incluindo todas as modalidades de tosa.
            Consulte a equipe para escolher o procedimento ideal para seu pet.
          </p>
        </div>
        <ul className="mx-auto mt-7 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Serviços estéticos oferecidos">
          {SERVICOS_ESTETICOS_MATILHA.map((servico, index) => (
            <li key={servico} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                {index < 3 ? <Scissors className="size-4" /> : <Sparkles className="size-4" />}
              </span>
              <span className="text-sm font-semibold">{servico === 'Tosa (modalidade a definir)' ? 'Tosa — todos os tipos' : servico}</span>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-7 flex max-w-3xl flex-col items-center gap-3 text-center">
          <p className="text-xs text-muted-foreground">Valores, duração, modalidade de tosa e horários são confirmados pela equipe. Não oferecemos hospedagem.</p>
          <a href={matilhaWhatsAppUrl('Olá! Vim pelo site da Matilha Prado. Gostaria de consultar valores e horários dos serviços estéticos para meu pet.')} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            <MessageCircle className="size-4" /> Consultar serviços e horários
          </a>
        </div>
      </div>
    </section>
  )
}
