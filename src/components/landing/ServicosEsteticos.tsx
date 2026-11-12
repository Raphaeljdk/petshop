import { ArrowUpRight, MessageCircle, PawPrint, Scissors, Sparkles } from 'lucide-react'
import { SERVICOS_ESTETICOS_MATILHA } from '@/lib/agenda-servicos'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

/** Vitrine informativa: não configura preço, pagamento ou reserva automática. */
export function ServicosEsteticos() {
  return (
    <section id="servicos" aria-labelledby="servicos-titulo" className="landing-services scroll-mt-24 border-y border-border/60 py-14 sm:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="landing-services-intro mx-auto max-w-3xl text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#b7470d]"><PawPrint className="size-4" /> Cuidado estético</p>
          <h2 id="servicos-titulo" className="text-3xl font-bold tracking-tight text-[#15344b] sm:text-4xl">Banho, tosa e cuidados para seu pet</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            A Matilha Prado realiza cuidados estéticos, incluindo todas as modalidades de tosa.
            Consulte a equipe para escolher o procedimento ideal para seu pet.
          </p>
        </div>
        <ul className="landing-services-grid mx-auto mt-9 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Serviços estéticos oferecidos">
          {SERVICOS_ESTETICOS_MATILHA.map((servico, index) => (
            <li key={servico} className="landing-service-card group flex items-center gap-3 rounded-2xl border border-[#dce6ed] bg-white px-4 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1e6] text-[#b7470d] transition-colors duration-200 group-hover:bg-[#ffe3d0]" aria-hidden="true">
                {index < 3 ? <Scissors className="size-4" /> : <Sparkles className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-[#17374f]">{servico === 'Tosa (modalidade a definir)' ? 'Tosa — todos os tipos' : servico}</span>
              <ArrowUpRight className="size-4 shrink-0 text-[#a9bbc7] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#b7470d]" aria-hidden="true" />
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 text-center">
          <p className="text-xs text-muted-foreground">Valores, duração, modalidade de tosa e horários são confirmados pela equipe. Não oferecemos hospedagem.</p>
          <a href={matilhaWhatsAppUrl('Olá! Vim pelo site da Matilha Prado. Gostaria de consultar valores e horários dos serviços estéticos para meu pet.')} target="_blank" rel="noopener noreferrer" className="landing-service-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#b7470d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#933809] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7470d]">
            <MessageCircle className="size-4" /> Consultar serviços e horários
          </a>
        </div>
      </div>
    </section>
  )
}
