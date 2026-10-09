import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Heart, MessageCircle, ShieldCheck, UserRound } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { MATILHA_CONTACT, matilhaWhatsAppUrl } from '@/lib/matilha-contact'

export const metadata: Metadata = {
  title: 'Privacidade e LGPD | Matilha Prado',
  description: 'Entenda como seus dados são utilizados na Matilha Prado e como solicitar acesso, correção e outros direitos previstos na LGPD.',
}

const sections = [
  { id: 'dados', title: 'Dados e finalidades' },
  { id: 'compartilhamento', title: 'Compartilhamento' },
  { id: 'cookies', title: 'Cookies e preferências' },
  { id: 'protecao', title: 'Proteção e conservação' },
  { id: 'direitos', title: 'Seus direitos' },
  { id: 'contato', title: 'Fale com a Matilha' },
]

export default function PrivacyPage() {
  return <div className="min-h-dvh bg-background">
    <a className="skip-link" href="#privacidade-conteudo">Pular para o conteúdo</a>
    <header className="border-b bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
      <Logo size="sm" />
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft className="size-4" aria-hidden="true" />Voltar à Matilha</Link>
    </div></header>
    <main id="privacidade-conteudo" className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="client-welcome overflow-hidden rounded-3xl p-6 text-white sm:p-10">
        <ShieldCheck className="mb-5 size-9 text-orange-300" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-200">Transparência faz parte do cuidado</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Seus dados também merecem cuidado.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">Conheça o aviso de privacidade da Matilha Prado: quais informações usamos no site, para que elas servem e como exercer seus direitos pela Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
        <p className="mt-5 text-xs text-slate-300">Atualizado em 7 de outubro de 2026</p>
      </div>
      <div className="my-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: UserRound, title: 'Sua conta', text: 'Dados para identificar você e atender seus pedidos.' },
          { icon: Heart, title: 'A rotina do seu pet', text: 'Informações para organizar os cuidados e atendimentos.' },
          { icon: MessageCircle, title: 'Um canal de conversa', text: 'Fale com a equipe sobre seus dados e seus direitos.' },
        ].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border bg-card p-5"><Icon className="mb-3 size-5 text-primary" aria-hidden="true" /><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
      </div>
      <nav aria-label="Nesta página" className="mb-8 flex flex-wrap gap-2">{sections.map(s => <a key={s.id} href={'#' + s.id} className="inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{s.title}</a>)}</nav>
      <article className="space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_section]:scroll-mt-6">
        <section aria-labelledby="responsavel"><h2 id="responsavel">Quem cuida desses dados</h2><p>A Matilha Prado é responsável pelo tratamento das informações usadas para operar sua conta, as compras e os atendimentos neste site. Fale com a loja pelo WhatsApp {MATILHA_CONTACT.whatsappDisplay} ou presencialmente na Av. Água Fria, 1647 — Santana, São Paulo/SP.</p></section>
        <section id="dados" aria-labelledby="dados-titulo"><h2 id="dados-titulo">1. Dados e finalidades</h2>
          <ul className="list-disc space-y-2 pl-5 marker:text-primary">
            <li><strong className="text-foreground">Cadastro e acesso:</strong> nome, e-mail, telefone, CPF/CNPJ e senha, para identificar sua conta e vinculá-la ao cadastro da loja. Endereço e CEP são utilizados quando informados, inclusive para entregas.</li>
            <li><strong className="text-foreground">Cuidados:</strong> dados do pet vinculados ao seu cadastro, agendamentos, serviços e informações de acompanhamento, para organizar o atendimento.</li>
            <li><strong className="text-foreground">Compras:</strong> itens, valores, endereço e situação do pagamento, para processar pedidos, entregar produtos e atender obrigações fiscais.</li>
            <li><strong className="text-foreground">Preferências:</strong> favoritos, avisos de estoque, lembretes, avaliações e benefícios do clube, quando você utiliza esses recursos.</li>
            <li><strong className="text-foreground">Operação do site:</strong> informações de sessão e registros técnicos necessários ao funcionamento, à segurança e à identificação de falhas.</li>
          </ul>
          <p className="mt-3">Conforme a finalidade, o tratamento pode se apoiar na execução de contrato ou de procedimentos solicitados por você, em obrigações legais e em outras hipóteses previstas na LGPD. Quando depender de consentimento, ele deve ser específico e informado. O login e a criação da conta não são uma autorização geral para publicidade.</p>
        </section>
        <section id="compartilhamento" aria-labelledby="compartilhamento-titulo"><h2 id="compartilhamento-titulo">2. Compartilhamento para atender você</h2>
          <p>O funcionamento da loja envolve prestadores de hospedagem e infraestrutura, o sistema de gestão Zetta/Siggma, pagamentos pelo Mercado Pago, serviços de entrega e cotação de frete, como o Melhor Envio, e serviços de e-mail para convites de acesso. As informações compartilhadas dependem do serviço utilizado e da operação necessária.</p>
          <p className="mt-3">Ao abrir WhatsApp, Instagram, Google ou outro serviço externo, você passa a utilizar um ambiente com política de privacidade própria. Consulte a equipe sobre os destinatários dos seus dados e o uso de infraestrutura de terceiros, inclusive quando houver tratamento fora do Brasil.</p>
        </section>
        <section id="cookies" aria-labelledby="cookies-titulo"><h2 id="cookies-titulo">3. Cookies e preferências do navegador</h2>
          <p>Um cookie de autenticação mantém o acesso à sua conta. Sem a opção “Manter conectado”, a autenticação tem validade de até 12 horas; ao marcar essa opção, pode chegar a 7 dias. Use-a apenas em um dispositivo de confiança. O botão “Sair” encerra a sessão neste navegador.</p>
          <p className="mt-3">O navegador também pode guardar preferências de aparência e a decisão de dispensar o convite para instalar o site como aplicativo. Você pode apagar esses dados nas configurações do navegador; isso pode encerrar seu acesso ou redefinir preferências. Este aviso não solicita autorização para cookies de publicidade.</p>
        </section>
        <section id="protecao" aria-labelledby="protecao-titulo"><h2 id="protecao-titulo">4. Proteção e conservação</h2>
          <p>As senhas são armazenadas em formato de hash, e o acesso às áreas da conta depende de autenticação. Não compartilhe sua senha: a equipe não precisa dela para atender uma solicitação sobre seus dados.</p>
          <p className="mt-3">Os dados são conservados conforme as finalidades do atendimento, obrigações legais e necessidade de exercício de direitos. Uma solicitação de exclusão pode não abranger registros que precisem ser mantidos por essas razões. A equipe pode esclarecer quais informações se aplicam ao seu caso.</p>
        </section>
        <section id="direitos" aria-labelledby="direitos-titulo"><h2 id="direitos-titulo">5. Seus direitos</h2>
          <p>A LGPD prevê, entre outros direitos, confirmar o tratamento e acessar seus dados; corrigir informações; solicitar anonimização, bloqueio ou eliminação quando cabíveis; obter informações sobre compartilhamento; e revogar consentimento quando essa for a base do tratamento. Portabilidade e revisão de decisões exclusivamente automatizadas podem ser solicitadas quando aplicáveis, observadas as regras legais.</p>
          <p className="mt-3">Diga à equipe o que precisa. Poderemos confirmar sua identidade para evitar a divulgação de dados a outra pessoa. Não envie senha ou dados completos de cartão.</p>
          <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Conheça seus direitos na ANPD<span className="sr-only"> (nova aba)</span></a>
        </section>
        <section id="contato" aria-labelledby="contato-titulo" className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7"><h2 id="contato-titulo">6. Fale com a Matilha sobre privacidade</h2>
          <p>Solicite acesso, correção ou esclarecimentos pelo atendimento. O botão abre uma mensagem inicial no WhatsApp; você decide quando enviá-la.</p>
          <a href={matilhaWhatsAppUrl('Olá, Matilha Prado! Gostaria de falar sobre meus dados pessoais e exercer meus direitos pela LGPD.')} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><MessageCircle className="size-5 shrink-0" aria-hidden="true" />Falar sobre meus dados<span className="sr-only"> (WhatsApp, nova aba)</span></a>
          <p className="mt-3 text-xs">WhatsApp: {MATILHA_CONTACT.whatsappDisplay}. Você também pode procurar a equipe presencialmente na loja.</p>
        </section>
      </article>
      <p className="mt-8 text-center text-xs leading-6 text-muted-foreground">Matilha Prado · Uma família cuidando da sua. Este aviso pode ser atualizado para refletir mudanças nos serviços.</p>
    </main>
  </div>
}
