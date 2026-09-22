'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ShieldCheck, Star, CalendarClock, Bell, ChevronRight, User as UserIcon, MapPin, Heart, PawPrint, Menu, MessageCircle, Instagram, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Logo } from '@/components/brand/Logo'
import { AccountExperience } from '@/components/auth/AccountExperience'
import type { AccountMode, AccountRole } from '@/components/auth/AccountForm'
import { cn } from '@/lib/utils'
import { MATILHA_CONTACT, matilhaWhatsAppUrl } from '@/lib/matilha-contact'

export function AuthScreen() {
  const [scrolled, setScrolled] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [modo, setModo] = useState<AccountMode>('login')
  const [accountRole, setAccountRole] = useState<AccountRole>('CLIENTE')
  const [authBusy, setAuthBusy] = useState(false)
  const authTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const media = window.matchMedia('(min-width: 768px)')
    const closeOnDesktop = () => { if (media.matches) setMobileNavOpen(false) }
    closeOnDesktop()
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [mobileNavOpen])

  const openAccount = (mode: AccountMode, role: AccountRole = 'CLIENTE') => {
    authTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setModo(mode)
    setAccountRole(role)
    setDialogOpen(true)
  }
  const abrirLogin = () => openAccount('login')
  const abrirCadastro = () => openAccount('cadastro')

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    setMobileNavOpen(false)
  }

  return (
    <div className="landing min-h-screen">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {/* Header */}
      <header
        className={cn(
          'landing-header fixed top-0 inset-x-0 z-40 transition-[box-shadow,border-color] duration-300',
          scrolled
            ? 'border-b border-border shadow-sm'
            : 'border-b border-transparent'
        )}
      >
        <div className="container mx-auto px-4 h-18 sm:h-20 flex items-center justify-between gap-2">
          <Logo size="sm" className="[&>div:last-child]:hidden sm:[&>div:last-child]:flex" />
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('como-funciona')} className="text-sm font-medium hover:text-primary transition-colors">
              Como Funciona
            </button>
            <button onClick={() => scrollTo('depoimentos')} className="text-sm font-medium hover:text-primary transition-colors">
              Depoimentos
            </button>
            <button onClick={() => scrollTo('nossa-historia')} className="text-sm font-medium hover:text-primary transition-colors">
              Nossa História
            </button>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="outline" size="sm" className="hidden md:flex h-9 border-pink-300/60 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800">
              <a href={MATILHA_CONTACT.instagram} target="_blank" rel="noreferrer" aria-label="Abrir Instagram da Matilha Prado">
                <Instagram className="size-4" />
                Instagram
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={abrirLogin} className="h-9 px-3">
              <span className="hidden sm:inline">Entrar</span>
              <span className="sm:hidden">Entrar</span>
            </Button>
            <Button size="sm" onClick={abrirCadastro} className="btn-brand h-9 px-3">
              <span className="hidden sm:inline">Cadastrar</span>
              <span className="sm:hidden">Cadastrar</span>
            </Button>
            {/* Hamburger mobile - só aparece em telas < md */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden size-10"
              onClick={() => setMobileNavOpen(true)}
              id="landing-menu-trigger"
              aria-expanded={mobileNavOpen}
              aria-label="Abrir menu de navegação"
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent className="p-6 gap-6" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('landing-menu-trigger')?.focus() }}>
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">Conheça a Matilha Prado ou acesse sua conta.</SheetDescription>
          <Logo size="sm" />
          <nav aria-label="Navegação do site" className="flex-1 pt-4 space-y-2">
            {[{ id: 'como-funciona', label: 'Como funciona' }, { id: 'depoimentos', label: 'Depoimentos' }, { id: 'nossa-historia', label: 'Nossa história' }].map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium hover:bg-muted">{item.label}</button>
            ))}
          </nav>
          <Button asChild variant="outline">
            <a href={MATILHA_CONTACT.instagram} target="_blank" rel="noreferrer" onClick={() => setMobileNavOpen(false)}>
              <Instagram className="size-4" /> Instagram
            </a>
          </Button>
          <Button variant="outline" onClick={() => { setMobileNavOpen(false); abrirLogin() }}>Entrar</Button>
          <Button onClick={() => { setMobileNavOpen(false); abrirCadastro() }}>Criar minha conta</Button>
        </SheetContent>
      </Sheet>

      {/* Hero: preserve the supplied brand artwork as the main visual. */}
      <main id="conteudo" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="container mx-auto px-6 sm:px-10 hero-grid">
          <div className="animate-slide-up">
            <p className="eyebrow text-cyan-200 flex items-center gap-2 mb-6"><PawPrint className="size-4" /> Matilha Prado · Pet shop</p>
            <h1 id="hero-title" className="hero-title">O melhor cuidado. <span>Para o seu melhor amigo.</span></h1>
            <p className="hero-description mt-6">Agende o banho, acompanhe cada etapa e encontre os favoritos do seu pet. Tudo em um só lugar, com o carinho da nossa família.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={abrirCadastro} className="bg-orange-300 text-slate-950 hover:bg-orange-200 shadow-lg shadow-black/10">Fazer parte da matilha <ChevronRight className="size-4" /></Button>
              <Button size="lg" variant="outline" onClick={abrirLogin} className="bg-white/5 text-white border-white/30 hover:bg-white/10 hover:text-white">Acessar minha conta</Button>
              <Button asChild size="lg" variant="outline" className="bg-green-500/10 text-white border-green-300/40 hover:bg-green-500/20 hover:text-white">
                <a href={matilhaWhatsAppUrl('Olá! Vim pelo site da Matilha Prado e gostaria de atendimento.')} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-pink-500/10 text-white border-pink-300/40 hover:bg-pink-500/20 hover:text-white">
                <a href={MATILHA_CONTACT.instagram} target="_blank" rel="noreferrer">
                  <Instagram className="size-4" /> Instagram
                </a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-white/75">
              <span className="flex items-center gap-2"><CalendarClock className="size-4 text-orange-300" /> Agendamento online</span>
              <span className="flex items-center gap-2"><Heart className="size-4 text-cyan-200" /> Cuidado de verdade</span>
            </div>
          </div>
          <div className="hero-brand">
            <div className="hero-brand-card"><Image src="/images/logo-matilha-prado-1024.png" alt="Matilha Prado — nossa marca" width={360} height={360} priority sizes="(max-width: 767px) 240px, 320px" /></div>
            <div className="hero-note animate-slide-up stagger-4">
              <span className="hero-note-icon"><PawPrint className="size-6" /></span>
              <div><p className="text-sm font-bold">Uma família cuidando da sua.</p><p className="text-xs text-slate-500 mt-0.5">Santana, São Paulo</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="landing-stats">
        <div className="container mx-auto px-4 py-6 sm:py-8 grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">500+</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">pets atendidos</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">50+</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">produtos premium</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">2</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">marketplaces integrados</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">4.9</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">avaliação dos clientes</p>
          </div>
        </div>
      </section>


      <section id="nossa-historia" className="story-section py-16 lg:py-24 mt-12">
        <div className="container mx-auto px-6 story-grid">
          <div className="story-heading">
            <p className="eyebrow text-primary mb-5">Nossa história</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">Onde o amor pelos cães <span className="text-primary">virou propósito.</span></h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">Conheça a família por trás da Matilha Prado.</p>
            <div className="mt-8 pt-6 border-t border-border flex gap-3 text-sm text-muted-foreground"><MapPin className="size-5 text-primary shrink-0" /><span>Av. Água Fria, 1647<br />Santana, São Paulo/SP</span></div>
          </div>
          <Reveal className="story-copy">
              <p>
                A <strong >Matilha Prado</strong> nasceu de um sonho construído em família e, literalmente, com as próprias mãos.
              </p>
              <p>
                <em>&ldquo;Matilha&rdquo;</em> representa aquilo que somos: uma família grande, unida e apaixonada por animais. Somos <strong >Aleksander e Karine</strong>, nossos filhos <strong >Sophia e Nicolas</strong>, e nossos três companheiros de quatro patas: <strong >Ragnar</strong>, nosso Husky Siberiano; <strong >Gyda</strong>, nossa Husky Siberiana; e <strong >Kira</strong>, nossa Pit Bull.
              </p>
              <p>
                E <em>&ldquo;Prado&rdquo;</em> é o nosso sobrenome, nossa família e a identidade que carregamos em tudo o que fazemos.
              </p>
              <p>
                A Matilha Prado foi idealizada, construída e cuidada em cada detalhe por mim e pela minha esposa. Colocamos a mão na massa, escolhemos cada cantinho, cada detalhe e cada produto pensando em uma coisa: proporcionar aos cães uma experiência de cuidado, conforto e muito amor.
              </p>
              <p>
                Abrimos nossas portas no dia <strong >21 de outubro de 2024</strong>, trazendo para <strong >Santana</strong> um espaço criado por quem realmente entende que nossos cães não são apenas animais de estimação — eles são parte da família.
              </p>
              <p>
                Aqui, cada serviço e cada produto é escolhido com muito carinho e responsabilidade.
              </p>
              <p>
                Oferecemos <strong >Spa Pet</strong>, banho com produtos <strong >Hydra</strong>, da <strong >Pet Society</strong>, além de uma boutique recheada com grandes marcas do mercado pet. Temos brinquedos <strong >KONG</strong> e <strong >Jambo</strong>, roupas <strong >Bonito pra Cachorro</strong>, petiscos <strong >Alecrim Pet</strong> e <strong >CarneLove</strong> e produtos para higiene bucal <strong >Arm &amp; Hammer</strong>.
              </p>
              <p>
                Tudo isso em um só lugar, pensado para cuidar, mimar e celebrar aqueles que tornam nossas vidas mais felizes.
              </p>
              <p>
                Na Matilha Prado, acreditamos que cada cão tem sua personalidade, suas necessidades e seu jeitinho especial. Por isso, nosso propósito vai muito além de oferecer produtos e serviços.
              </p>
              <p>
                Queremos que cada pet que entre pela nossa porta seja tratado como parte da nossa própria matilha.
              </p>
              <p>
                Seja muito bem-vindo à Matilha Prado.
              </p>
              <p className="story-signature">
                Uma família cuidando da sua família. 🐾❤️
              </p>
          </Reveal>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-12 sm:py-16 lg:py-20 bg-navy-gradient text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-3">Simples e rápido</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Como Funciona</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {[
              {
                num: '1',
                title: 'Crie sua conta',
                desc: 'Faça seu cadastro em segundos e adicione os dados do seu pet.',
                icon: UserIcon,
              },
              {
                num: '2',
                title: 'Agende ou compre',
                desc: 'Marque um serviço ou compre produtos da boutique com poucos cliques.',
                icon: CalendarClock,
              },
              {
                num: '3',
                title: 'Acompanhe em tempo real',
                desc: 'Receba notificações e acompanhe o status do seu pet pelo Kanban.',
                icon: Bell,
              },
            ].map((p) => {
              const Icon = p.icon
              return (
                <div key={p.num} className="step-card card-hover">
                  <div className="step-number">
                    0{p.num}
                  </div>
                  <Icon className="size-6 text-orange-300 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                  <p className="text-sm text-white/70">{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-12 sm:py-16 lg:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <Badge variant="secondary" className="mb-3">Depoimentos</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Quem usa, ama</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Veja o que os tutores dizem sobre a Matilha Prado.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              {
                nome: 'Mariana Silva',
                pet: 'Tutora do Thor',
                depo: 'Agendar banho ficou super prático. Recebo SMS quando o Thor está pronto. Equipe atenciosa e produtos premium.',
              },
              {
                nome: 'Carlos Mendes',
                pet: 'Tutor da Luna',
                depo: 'Acompanhei todo o atendimento pelo Kanban em tempo real. Transparência total, adorei a experiência.',
              },
              {
                nome: 'Juliana Prado',
                pet: 'Tutora do Bob',
                depo: 'Comprei brinquedos KONG pela loja online e recebi rapidinho. Qualidade impecável e preços justos.',
              },
            ].map((d) => (
              <Card key={d.nome} className="card-hover py-0">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="size-4 fill-orange-400 text-orange-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    &ldquo;{d.depo}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                      {d.nome[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">{d.pet}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section id="planos" className="py-12 sm:py-16 lg:py-20 bg-navy-gradient text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 size-96 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative text-center max-w-2xl">
          <Heart className="size-10 sm:size-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold">
            Pronto para cuidar do seu pet?
          </h2>
          <p className="mt-4 text-white/80 text-base sm:text-lg">
            Crie sua conta gratuita e comece a agendar serviços e comprar produtos premium agora mesmo.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={abrirCadastro} className="btn-brand h-12">
              Criar conta gratuita
            </Button>
            <Button size="lg" variant="outline" onClick={abrirLogin} className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white h-12">
              Já tenho conta
            </Button>
          </div>
        </div>
      </section>

      </main>
      {/* Footer */}
      <footer className="bg-navy-gradient text-white">
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <div className="col-span-2 sm:col-span-2">
              <Logo size="md" variant="light" />
              <p className="mt-4 text-sm text-white/70 max-w-md">
                Pet shop em Santana, São Paulo. Spa Pet, banho com produtos premium e boutique com as melhores marcas do mercado.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400">
                  Mercado Livre
                </Badge>
                <Badge className="bg-orange-500 text-white hover:bg-orange-500">
                  Amazon
                </Badge>
              </div>
              <p className="mt-4 text-sm text-white/70 flex items-center gap-2">
                <MapPin className="size-4" />
                Av. Água Fria, 1647 — Santana, São Paulo/SP
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href={matilhaWhatsAppUrl('Olá! Vim pelo site da Matilha Prado.')} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> {MATILHA_CONTACT.whatsappDisplay}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href={MATILHA_CONTACT.instagram} target="_blank" rel="noreferrer">
                    <Instagram className="size-4" /> Instagram
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href={MATILHA_CONTACT.google} target="_blank" rel="noreferrer">
                    <Navigation className="size-4" /> Google
                  </a>
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-3">Navegação</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors">Como Funciona</button></li>
                <li><button onClick={() => scrollTo('depoimentos')} className="hover:text-white transition-colors">Depoimentos</button></li>
                <li><button onClick={() => scrollTo('nossa-historia')} className="hover:text-white transition-colors">Nossa História</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-3">Sua conta</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><button onClick={abrirCadastro} className="hover:text-white transition-colors">Cadastro de cliente</button></li>
                <li><button onClick={() => openAccount('cadastro', 'ADMIN')} className="hover:text-white transition-colors">Cadastro de administrador</button></li>
                <li><button onClick={() => openAccount('login', 'ADMIN')} className="hover:text-white transition-colors">Acesso da equipe</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/60">
              © {new Date().getFullYear()} Matilha Prado — Pet Shop. Todos os direitos reservados.
            </p>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
              <ShieldCheck className="size-3" /> Acesso individual
            </Badge>
          </div>
        </div>
      </footer>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!authBusy) setDialogOpen(open) }}>
        <DialogContent className="account-dialog" showCloseButton={!authBusy}
          onCloseAutoFocus={event => { event.preventDefault(); authTriggerRef.current?.focus() }}>
          <DialogTitle className="sr-only">Acesso à Matilha Prado</DialogTitle>
          <DialogDescription className="sr-only">Entre na sua conta ou faça seu cadastro como cliente ou administrador.</DialogDescription>
          <AccountExperience key={modo + accountRole} initialMode={modo} initialRole={accountRole}
            onSuccess={() => setDialogOpen(false)} onBusyChange={setAuthBusy} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
