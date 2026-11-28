'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Clock, Instagram, MapPin, MessageCircle, Navigation, PawPrint } from 'lucide-react'
import { MATILHA_CONTACT, matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import { saveTrackingChoices, trackingChoices } from '@/lib/storefront-events'
import { InstallAppCard } from '@/components/pwa/InstallAppCard'
import { GoogleReviews } from './GoogleReviews'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function Wordmark() {
  return (
    <span className="mp-wordmark">
      <PawPrint aria-hidden="true" fill="currentColor" />
      <span>
        Matilha
        <br />
        Prado
      </span>
    </span>
  )
}
export function StoreFooter({
  onRegister,
  onStaff,
  onStaffRegister,
}: {
  onRegister: () => void
  onStaff: () => void
  onStaffRegister: () => void
}) {
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState({ analytics: false, ads: false })
  const [message, setMessage] = useState('')
  const photo = process.env.NEXT_PUBLIC_MATILHA_FOTO_LOJA
  return (
    <>
      <section className="mp-section" id="depoimentos">
        <div className="mp-heading">
          <PawPrint className="mp-heading-icon" />
          <div>
            <h2>Avaliações no Google</h2>
            <p>Experiências compartilhadas por quem já veio à loja.</p>
          </div>
        </div>
        <GoogleReviews />
      </section>
      <section className="mp-section mp-story" id="nossa-historia">
        <div>
          <span className="mp-kicker">Nossa história</span>
          <h2>Uma família cuidando da sua.</h2>
        </div>
        <div>
          <p>
            Aleksander e Karine construíram a Matilha Prado com as próprias mãos. O nome reúne o
            sobrenome da família e a matilha que inspirou a loja, com os huskies Ragnar e Gyda e a pit
            bull Kira.
          </p>
          <p>
            Desde 21 de outubro de 2024, a família recebe os pets de Santana para o banho, a tosa e os
            cuidados da boutique.
          </p>
          {photo && /^https:\/\//.test(photo) && (
            <img
              src={photo}
              loading="lazy"
              referrerPolicy="no-referrer"
              alt="Estabelecimento da Matilha Prado em Santana"
              width="640"
              height="420"
            />
          )}
        </div>
      </section>
      <div className="mp-section">
        <InstallAppCard compact />
      </div>
      <footer className="mp-footer" id="contato">
        <div className="mp-footer-grid">
          <div>
            <Wordmark />
            <p>
              <MapPin />
              Av. Água Fria, 1647 · Santana, São Paulo/SP
            </p>
            <p>
              <Clock />
              Atendimento das 09h às 20h
            </p>
            <div className="mp-social">
              <a href={matilhaWhatsAppUrl()}>
                <MessageCircle />
                {MATILHA_CONTACT.whatsappDisplay}
              </a>
              <a href={MATILHA_CONTACT.instagram}>
                <Instagram />
                Instagram
              </a>
              <a href={MATILHA_CONTACT.google}>
                <MapPin />
                Google Maps
              </a>
              <a href={MATILHA_CONTACT.waze}>
                <Navigation />
                Waze
              </a>
            </div>
          </div>
          <div>
            <h3>Atendimento</h3>
            <Link href="/privacidade">Privacidade e LGPD</Link>
            <Link href="/atendimento#trocas">Trocas e devoluções</Link>
            <Link href="/atendimento#entrega">Entrega e retirada</Link>
            <Link href="/atendimento#pagamento">Pagamentos</Link>
            <button
              onClick={() => {
                setChoices(trackingChoices())
                setMessage('')
                setOpen(true)
              }}
            >
              Preferências de privacidade
            </button>
          </div>
          <div>
            <h3>Minha conta</h3>
            <button onClick={onRegister}>Cadastro de cliente</button>
            <button onClick={onStaff}>Acesso da equipe</button>
            <button onClick={onStaffRegister}>Cadastro de administrador</button>
          </div>
        </div>
      </footer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Preferências de privacidade</DialogTitle>
          <DialogDescription>
            Escolha se a Matilha pode medir o uso da loja e as conversões das campanhas neste navegador.
            Você pode alterar as escolhas a qualquer momento.
          </DialogDescription>
          <label className="mp-consent">
            <input
              type="checkbox"
              checked={choices.analytics}
              onChange={(e) => setChoices({ ...choices, analytics: e.target.checked })}
            />
            Medição de uso da loja (Google Analytics)
          </label>
          <label className="mp-consent">
            <input
              type="checkbox"
              checked={choices.ads}
              onChange={(e) => setChoices({ ...choices, ads: e.target.checked })}
            />
            Medição de campanhas (Google Ads e Meta)
          </label>
          <button
            className="mp-btn mp-orange"
            onClick={() => {
              if (saveTrackingChoices(choices)) setOpen(false)
              else setMessage('O navegador bloqueou o armazenamento. A medição fica desativada.')
            }}
          >
            Salvar preferências
          </button>
          {message && <p role="status">{message}</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}
