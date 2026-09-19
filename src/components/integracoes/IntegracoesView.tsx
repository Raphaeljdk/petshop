'use client'

import { useEffect, useState } from 'react'
import {
  Plug,
  CheckCircle2,
  XCircle,
  CreditCard,
  Bike,
  Info,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  ConfiguracaoFrete,
  ConfiguracaoPagamento,
  Integracao,
} from '@/lib/types'

type EstadoIntegracoes = {
  pagamento: ConfiguracaoPagamento | null
  frete: ConfiguracaoFrete | null
  outras: Integracao[]
}

export function IntegracoesView() {
  const [estado, setEstado] = useState<EstadoIntegracoes>({
    pagamento: null,
    frete: null,
    outras: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const [pagamentoRes, freteRes, integracoesRes] = await Promise.all([
          fetch('/api/pagamento/config', { credentials: 'same-origin' }),
          fetch('/api/frete/config', { credentials: 'same-origin' }),
          fetch('/api/integracoes', { credentials: 'same-origin' }),
        ])

        const pagamento = pagamentoRes.ok
          ? ((await pagamentoRes.json()) as ConfiguracaoPagamento)
          : null
        const frete = freteRes.ok
          ? ((await freteRes.json()) as ConfiguracaoFrete)
          : null
        const todas: Integracao[] = integracoesRes.ok
          ? await integracoesRes.json()
          : []

        if (!cancelado) {
          setEstado({
            pagamento,
            frete,
            outras: todas.filter(
              (i) =>
                !['mercado_livre', 'amazon', 'mercado_pago', 'correios'].includes(
                  i.plataforma
                )
            ),
          })
        }
      } catch (e) {
        console.error('integracoes erro:', e)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  const pagamentoPronto =
    estado.pagamento?.checkoutPronto ??
    Boolean(
      estado.pagamento?.mercadoPagoAtivo &&
        estado.pagamento?.mercadoPagoPublicKey
    )

  const motoboyAtivo = Boolean(estado.frete?.entregaPropriaAtiva)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Integrações
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Serviços conectados ao sistema
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex gap-3">
          <Info className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 mb-1">
              Sobre Mercado Livre e Amazon
            </p>
            <p className="text-blue-800 text-xs leading-relaxed">
              As integrações com marketplaces exigem credenciais e aprovação
              específicas de cada plataforma e são configuradas pelo
              desenvolvedor.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={pagamentoPronto ? 'border-green-300' : 'border-amber-300'}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="size-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Mercado Pago</CardTitle>
                  <CardDescription className="text-xs">
                    Checkout Transparente
                  </CardDescription>
                </div>
              </div>
              <Badge variant={pagamentoPronto ? 'default' : 'secondary'}>
                {pagamentoPronto ? (
                  <>
                    <CheckCircle2 className="size-3 mr-1" /> Ativo
                  </>
                ) : (
                  <>
                    <XCircle className="size-3 mr-1" /> Incompleto
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {pagamentoPronto ? (
              <>
                <p className="flex items-center gap-1.5 text-green-700">
                  <ShieldCheck className="size-3.5" />
                  Access Token e Public Key configurados.
                </p>
                <p>
                  PIX, cartão e boleto usam o Checkout Transparente dentro do
                  portal.
                </p>
                {!estado.pagamento?.webhookSecretConfigurado && (
                  <p className="flex items-start gap-1.5 text-amber-700">
                    <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                    Falta configurar o segredo do webhook para concluir a
                    confirmação automática dos pagamentos.
                  </p>
                )}
              </>
            ) : (
              <p>
                Abra a aba &quot;Pagamentos&quot;. O sistema precisa do Access
                Token, Public Key e da integração ativada para cobrar de verdade.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={motoboyAtivo ? 'border-green-300' : ''}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Bike className="size-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Motoboy Matilha Prado
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Entrega própria
                  </CardDescription>
                </div>
              </div>
              <Badge variant={motoboyAtivo ? 'default' : 'secondary'}>
                {motoboyAtivo ? (
                  <>
                    <CheckCircle2 className="size-3 mr-1" /> Ativo
                  </>
                ) : (
                  <>
                    <XCircle className="size-3 mr-1" /> Inativo
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>Zona Norte de São Paulo.</p>
            <p>
              Taxa fixa: <strong className="text-foreground">R$ 20,00</strong>
            </p>
            <p>Faixa operacional de CEP: 02000-000 a 02999-999.</p>
            <p className="text-amber-700">
              Correios/Sedex desativado para novos pedidos.
            </p>
          </CardContent>
        </Card>
      </div>

      {estado.outras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outras integrações ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {estado.outras.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between p-2 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Plug className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">
                    {i.plataforma.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {i.ultimaSync && (
                    <span className="text-xs text-muted-foreground">
                      Última sync:{' '}
                      {format(parseISO(i.ultimaSync), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  )}
                  <Badge variant={i.ativo ? 'default' : 'secondary'}>
                    {i.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Carregando integrações...
          </CardContent>
        </Card>
      )}
    </div>
  )
}
