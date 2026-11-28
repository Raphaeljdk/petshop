import Link from 'next/link'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
export default function Atendimento() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-12 leading-7">
      <Link className="underline" href="/loja">
        Voltar à loja
      </Link>
      <h1 className="text-3xl font-bold">Atendimento da loja</h1>
      <section id="entrega">
        <h2 className="text-xl font-bold">Entrega e retirada</h2>
        <p>
          Informe o CEP no carrinho para consultar as modalidades, o frete e o prazo disponíveis para o
          seu pedido. Para retirada, aguarde a confirmação antes de ir à Av. Água Fria, 1647, Santana,
          São Paulo.
        </p>
      </section>
      <section id="trocas">
        <h2 className="text-xl font-bold">Trocas e devoluções</h2>
        <p>
          Para solicitar uma troca ou relatar um problema, informe o número do pedido e o produto à
          equipe. Nas compras de produtos pela internet, você pode comunicar a desistência em até sete
          dias corridos após o recebimento, com devolução dos valores pagos e sem custo de frete de
          devolução.
        </p>
        <a className="underline" href="https://www.procon.sp.gov.br/reclamacoes-de-compras-online/">
          Orientações do Procon-SP
        </a>
      </section>
      <section id="pagamento">
        <h2 className="text-xl font-bold">Pagamento do pedido</h2>
        <p>
          As formas disponíveis aparecem no checkout do Mercado Pago. Confira o valor antes de pagar e
          acompanhe o status em Minhas Compras. A equipe não solicita a sua senha nem os dados completos
          do cartão pelo WhatsApp.
        </p>
      </section>
      <a
        className="inline-flex min-h-11 items-center rounded-lg bg-black px-5 font-medium text-white"
        href={matilhaWhatsAppUrl('Olá! Preciso de atendimento sobre um pedido da Matilha Prado.')}
      >
        Falar com a Matilha Prado
      </a>
    </main>
  )
}
