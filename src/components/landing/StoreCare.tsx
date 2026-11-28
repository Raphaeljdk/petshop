'use client'
import { useState } from 'react'
import { CalendarDays, Check, ChevronRight, Crown, Gift, Scissors, Ticket } from 'lucide-react'
import { SERVICOS_ESTETICOS_MATILHA } from '@/lib/agenda-servicos'
import { AtendimentoMenu } from './AtendimentoMenu'
import { money } from '@/lib/storefront-catalog'
import { activeSeason, seasonalCampaigns, type ShopInfo } from '@/lib/storefront-content'
export function PlansRibbon({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mp-ribbon" aria-label="Clube Matilha Prado">
      <div>
        <Crown />
        <h2>
          Planos <em>Matilha Prado</em>
        </h2>
      </div>
      <ul>
        <li>
          <Check />
          Sessões de banho
        </li>
        <li>
          <Check />
          Condições de cada plano
        </li>
      </ul>
      <button className="mp-btn mp-orange" onClick={onOpen}>
        Conhecer planos
        <ChevronRight />
      </button>
      <img src="/images/vitrine/presente.webp" alt="" width="116" height="115" loading="lazy" />
    </section>
  )
}
export function CareDetails({
  info,
  loading,
  retry,
  onBook,
  onPlan,
}: {
  info: ShopInfo | null
  loading: boolean
  retry: () => void
  onBook: () => void
  onPlan: (id: string) => void
}) {
  const [compare, setCompare] = useState(false)
  const plans = info?.plans
  const services = [...new Set([...SERVICOS_ESTETICOS_MATILHA, ...Object.keys(info?.services || {})])]
  function servicePrice(name: string) {
    const range = info?.services?.[name]
    if (!range) return 'Sob consulta'
    return range.min === range.max ? money(range.min) : money(range.min) + ' a ' + money(range.max)
  }
  return (
    <>
      <section className="mp-section" id="servicos">
        <div className="mp-heading">
          <Scissors className="mp-heading-icon" />
          <div>
            <h2>Banho, tosa e spa</h2>
            <p>Cuidados com a pele e a pelagem, com produtos Hydra da Pet Society.</p>
          </div>
        </div>
        <ul className="mp-services">
          {services.map((s) => (
            <li key={s}>
              <span>{s.startsWith('Tosa (') ? 'Tosa em diferentes modalidades' : s}</span>
              <small>{servicePrice(s)}</small>
            </li>
          ))}
        </ul>
        <div className="mp-actions">
          <button className="mp-btn mp-orange" onClick={onBook}>
            <CalendarDays />
            Agendar pelo portal
          </button>
          <AtendimentoMenu label="Consultar horários" className="mp-btn mp-light" />
        </div>
        <div className="mp-faqs">
          <details className="mp-faq">
            <summary>Como escolho a modalidade de tosa?</summary>
            <p>
              Informe a raça, a pelagem e o resultado desejado. A equipe confirma a modalidade, o valor e
              a duração antes do atendimento.
            </p>
          </details>
          <details className="mp-faq">
            <summary>Quando o meu horário fica reservado?</summary>
            <p>
              No portal, selecione o pet, o serviço e um horário disponível. A reserva aparece em Meus
              Agendamentos após a confirmação. Pelo WhatsApp, a equipe consulta a disponibilidade.
            </p>
          </details>
          <details className="mp-faq">
            <summary>Como acompanho os banhos de um plano?</summary>
            <p>
              Na sua conta, abra Meus Pets para consultar o plano, os atendimentos utilizados e o saldo
              de sessões.
            </p>
          </details>
        </div>
      </section>
      <section className="mp-section" id="planos">
        <div className="mp-heading">
          <Crown className="mp-heading-icon" />
          <div>
            <h2>Planos de banho</h2>
            <p>Escolha pelo número de sessões, validade e valor.</p>
          </div>
          {plans && plans.length > 1 && (
            <button
              className="mp-text-link"
              onClick={() => setCompare(!compare)}
              aria-expanded={compare}
            >
              {compare ? 'Fechar comparação' : 'Comparar planos'}
              <ChevronRight />
            </button>
          )}
        </div>
        {loading ? (
          <p role="status">Consultando planos…</p>
        ) : !plans ? (
          <div className="mp-state">
            Os planos estão temporariamente indisponíveis.{' '}
            <button className="mp-text-link" onClick={retry}>
              Tentar novamente
            </button>
          </div>
        ) : plans.length === 0 ? (
          <p className="mp-state">Nenhum plano aberto para contratação no momento.</p>
        ) : (
          <>
            {compare && (
              <div
                className="mp-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Comparação de planos"
              >
                <table>
                  <caption>Comparação dos planos disponíveis</caption>
                  <thead>
                    <tr>
                      {['Plano', 'Sessões', 'Validade', 'Total', 'Por sessão'].map((t) => (
                        <th key={t} scope="col">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">{p.title}</th>
                        <td>{p.sessions}</td>
                        <td>{p.durationDays} dias</td>
                        <td>{money(p.priceCents / 100)}</td>
                        <td>
                          {p.sessions > 0 ? money(p.priceCents / 100 / p.sessions) : 'Sob consulta'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mp-plan-cards">
              {plans.map((p) => (
                <article key={p.id}>
                  <Crown />
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                  <strong>{money(p.priceCents / 100)}</strong>
                  <span>
                    {p.sessions} sessões · {p.durationDays} dias
                  </span>
                  {p.savingsCents != null && p.savingsCents > 0 && (
                    <span>
                      Economia de {money(p.savingsCents / 100)} sobre {p.sessions} sessões avulsas de{' '}
                      {p.comparedService}.
                    </span>
                  )}
                  <button className="mp-btn mp-light" onClick={() => onPlan(p.id)}>
                    Solicitar este plano
                    <ChevronRight />
                  </button>
                </article>
              ))}
            </div>
            <p className="mp-note">
              Escolha o pet na sua conta. A equipe analisa a solicitação e as opções de pagamento
              aparecem no portal conforme a disponibilidade.
            </p>
          </>
        )}
      </section>
    </>
  )
}
export function Campaigns({
  info,
  onShop,
}: {
  info: ShopInfo | null
  onShop: (s: 'ofertas' | 'novidades') => void
}) {
  const season = activeSeason(),
    campaign = season ? seasonalCampaigns[season] : null
  const coupons = info?.coupons || []
  if (!campaign && !coupons.length) return null
  return (
    <section className="mp-section" id="campanhas">
      <div className="mp-heading">
        <Gift className="mp-heading-icon" />
        <h2>Campanhas da Matilha</h2>
      </div>
      {campaign && (
        <div className={'mp-season ' + season}>
          <h3>{campaign.label}</h3>
          <p>{campaign.title}</p>
          <button className="mp-btn mp-light" onClick={() => onShop(campaign.destination)}>
            Explorar campanha
          </button>{' '}
          <a
            className="mp-text-link"
            href={
              'https://wa.me/?text=' +
              encodeURIComponent(
                'Confira ' +
                  campaign.label +
                  ' ' +
                  ((typeof window === 'undefined' ? '' : window.location.origin) +
                    '/loja?campanha=' +
                    season),
              )
            }
          >
            Compartilhar
          </a>
        </div>
      )}
      {coupons.map((c) => (
        <div className="mp-coupon" key={c.codigo}>
          <Ticket />
          <div>
            <strong>{c.codigo}</strong> ·{' '}
            {c.tipoDesconto === 'percentual' ? c.valor + '%' : money(c.valor)} de desconto
            {c.descricao && <p>{c.descricao}</p>}
            <small>
              {c.valorMinimo > 0 ? 'Pedido mínimo de ' + money(c.valorMinimo) + '. ' : ''}
              {c.fimEm
                ? 'Válido até ' +
                  new Date(c.fimEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) +
                  '. '
                : ''}
              Aplicação sujeita à validação no carrinho.
            </small>
          </div>
        </div>
      ))}
    </section>
  )
}
