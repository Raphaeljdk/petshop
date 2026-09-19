'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  QrCode as QrCodeIcon,
  CreditCard,
  Barcode,
  Check,
  Clock,
  Copy,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet,
  ArrowRight,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MetodoPagamento, PagamentoCriarResposta } from '@/lib/types'

interface PagamentoCheckoutProps {
  vendaId: string
  total: number
  onAprovado?: () => void
  onCancelar?: () => void
}

interface ConfigPublica {
  mercadoPagoAtivo: boolean
  pixAtivo: boolean
  cartaoAtivo: boolean
  boletoAtivo: boolean
  simulado: boolean
  publicKey: string | null
}

interface StatusResponse {
  vendaId: string
  statusVenda: string
  mercadoPagoStatus: string | null
  mercadoPagoId: string | null
  total: number
  paymentUrl: string | null
  qrCode: string | null
  pixExpiresAt: string | null
  aprovado: boolean
  rejeitado: boolean
  simulado: boolean
  updatedAt: string
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const METODOS: {
  id: MetodoPagamento
  label: string
  descricao: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    id: 'pix',
    label: 'PIX',
    descricao: 'Aprovação imediata · 5% de desconto às vezes',
    icon: QrCodeIcon,
  },
  {
    id: 'cartao',
    label: 'Cartão de crédito',
    descricao: 'Visa, Master, Elo, Amex · até 12x',
    icon: CreditCard,
  },
  {
    id: 'boleto',
    label: 'Boleto bancário',
    descricao: 'Vence em 3 dias · aprovação em 1-2 dias úteis',
    icon: Barcode,
  },
]

export function PagamentoCheckout({
  vendaId,
  total,
  onAprovado,
  onCancelar,
}: PagamentoCheckoutProps) {
  const [config, setConfig] = useState<ConfigPublica | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [metodo, setMetodo] = useState<MetodoPagamento | null>(null)
  const [dadosAberto, setDadosAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [pagamento, setPagamento] = useState<PagamentoCriarResposta | null>(null)

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [tempoRestante, setTempoRestante] = useState<number | null>(null)
  const [tempoEsgotado, setTempoEsgotado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const comecouRef = useRef<number>(Date.now())

  // Carrega config pública
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/pagamento/config', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          if (!cancelado) setConfig(data)
        }
      } catch (e) {
        console.error('[PagamentoCheckout] config erro:', e)
      } finally {
        if (!cancelado) setLoadingConfig(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  // Métodos disponíveis conforme config
  const metodosDisponiveis = METODOS.filter((m) => {
    if (!config) return true
    if (m.id === 'pix') return config.pixAtivo
    if (m.id === 'cartao') return config.cartaoAtivo
    if (m.id === 'boleto') return config.boletoAtivo
    return false
  })

  // Seleção automática do primeiro método disponível
  useEffect(() => {
    if (!config) return
    if (!metodo && metodosDisponiveis.length > 0) {
      setMetodo(metodosDisponiveis[0].id)
    }
  }, [config, metodosDisponiveis, metodo])

  // Limpa polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  // Timer de expiração do PIX
  useEffect(() => {
    if (!pagamento?.pixExpiresAt) {
      setTempoRestante(null)
      return
    }
    const expires = new Date(pagamento.pixExpiresAt).getTime()
    const tick = () => {
      const restante = Math.max(0, expires - Date.now())
      setTempoRestante(restante)
      if (restante <= 0 && !status?.aprovado) {
        setTempoEsgotado(true)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [pagamento?.pixExpiresAt, status?.aprovado])

  // Limite de polling: 5 minutos
  useEffect(() => {
    if (!pagamento) return
    const limite = 5 * 60 * 1000
    const decorrido = Date.now() - comecouRef.current
    if (decorrido >= limite && !status?.aprovado) {
      setTempoEsgotado(true)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [pagamento, status?.aprovado])

  const iniciarPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      // Limite de 5 min
      const decorrido = Date.now() - comecouRef.current
      if (decorrido >= 5 * 60 * 1000) {
        setTempoEsgotado(true)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        return
      }
      try {
        const res = await fetch(
          `/api/pagamento/status?vendaId=${encodeURIComponent(vendaId)}`,
          { credentials: 'same-origin' }
        )
        if (!res.ok) return
        const data: StatusResponse = await res.json()
        setStatus(data)
        if (data.aprovado) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          toast.success('Pagamento aprovado! 🎉')
          // Pequeno delay para o confetti aparecer
          setTimeout(() => {
            onAprovado?.()
          }, 1800)
        } else if (data.rejeitado) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          toast.error('Pagamento rejeitado')
        }
      } catch (e) {
        console.error('[PagamentoCheckout] polling erro:', e)
      }
    }, 4000)
  }, [vendaId, onAprovado])

  // Iniciar pagamento quando método selecionado (não inicia automático —
  // espera clique do usuário, exceto PIX que já mostra QR ao selecionar)
  const criarPagamento = useCallback(
    async (
      metodoSel: MetodoPagamento,
      extra: Record<string, unknown> = {}
    ): Promise<PagamentoCriarResposta> => {
      setCriando(true)
      setPagamento(null)
      setStatus(null)
      setTempoEsgotado(false)
      comecouRef.current = Date.now()

      try {
        const res = await fetch('/api/pagamento/criar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ vendaId, metodo: metodoSel, ...extra }),
        })

        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d?.error || 'Erro ao criar pagamento')
        }

        const data: PagamentoCriarResposta = await res.json()
        setPagamento(data)

        if (data.simulado) {
          toast.info('Modo simulado ativo — pagamento será aprovado em 10s')
        } else if (metodoSel === 'pix') {
          toast.success('PIX gerado pelo Mercado Pago')
        } else if (metodoSel === 'boleto') {
          toast.success('Boleto gerado pelo Mercado Pago')
        } else if (data.orderStatus === 'processed') {
          toast.success('Pagamento processado')
        }

        iniciarPolling()
        return data
      } catch (e: any) {
        toast.error(e.message || 'Erro ao criar pagamento')
        throw e
      } finally {
        setCriando(false)
      }
    },
    [vendaId, iniciarPolling]
  )

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      toast.success('Código copiado!')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const formatarTempo = (ms: number) => {
    const total = Math.floor(ms / 1000)
    const min = Math.floor(total / 60)
    const sec = total % 60
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }



  if (loadingConfig) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  // ===== Estado: pagamento aprovado =====
  if (status?.aprovado) {
    return (
      <div className="space-y-4 py-2">
        <div className="text-center space-y-2">
          <div className="size-16 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="size-10" />
          </div>
          <h3 className="text-lg font-bold text-green-700">
            Pagamento aprovado!
          </h3>
          <p className="text-sm text-muted-foreground">
            Compra <span className="font-mono">#{vendaId.slice(-8).toUpperCase()}</span>{' '}
            confirmada com sucesso.
          </p>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <PartyPopper className="size-3.5 text-amber-500" />
            <span>{fmtMoeda(total)}</span>
          </div>
        </div>
      </div>
    )
  }

  // ===== Estado: pagamento rejeitado =====
  if (status?.rejeitado) {
    return (
      <div className="space-y-4 py-2">
        <div className="text-center space-y-2">
          <div className="size-16 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
            <XCircle className="size-10" />
          </div>
          <h3 className="text-lg font-bold text-red-700">Pagamento rejeitado</h3>
          <p className="text-sm text-muted-foreground">
            Tente novamente com outro método.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full h-10"
          onClick={() => {
            setPagamento(null)
            setStatus(null)
            setTempoEsgotado(false)
            setDadosAberto(false)
          }}
        >
          Voltar
        </Button>
      </div>
    )
  }

  // ===== Estado: tempo esgotado (5 min sem pagamento) =====
  if (tempoEsgotado) {
    return (
      <div className="space-y-4 py-2">
        <div className="text-center space-y-2">
          <div className="size-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <Clock className="size-10" />
          </div>
          <h3 className="text-lg font-bold text-amber-700">Tempo esgotado</h3>
          <p className="text-sm text-muted-foreground">
            O prazo para pagamento expirou. Gere um novo QR/boleto para tentar
            novamente.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full h-10"
          onClick={() => {
            setPagamento(null)
            setStatus(null)
            setTempoEsgotado(false)
            if (metodo) criarPagamento(metodo)
          }}
        >
          Gerar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="size-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total a pagar</p>
            <p className="font-bold text-base sm:text-lg text-primary">
              {fmtMoeda(total)}
            </p>
          </div>
        </div>
        {config?.simulado && (
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
            <AlertCircle className="size-3 mr-1" /> Simulado
          </Badge>
        )}
      </div>

      {/* Fluxo transparente: PIX direto; cartão via Brick; boleto com dados do pagador */}
      {!pagamento && dadosAberto && metodo === 'cartao' ? (
        <CartaoTransparente
          vendaId={vendaId}
          total={total}
          publicKey={config?.publicKey || ''}
          criando={criando}
          onSubmit={(card) => criarPagamento('cartao', { card })}
          onVoltar={() => setDadosAberto(false)}
        />
      ) : !pagamento && dadosAberto && metodo === 'boleto' ? (
        <BoletoForm
          criando={criando}
          onSubmit={(boleto) => criarPagamento('boleto', { boleto })}
          onVoltar={() => setDadosAberto(false)}
        />
      ) : !pagamento ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Escolha o método de pagamento</p>
          </div>

          {metodosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              Nenhum método de pagamento disponível no momento.
            </p>
          ) : (
            <RadioGroup
              value={metodo || ''}
              onValueChange={(v) => {
                setMetodo(v as MetodoPagamento)
                setDadosAberto(false)
              }}
              className="gap-2"
            >
              {metodosDisponiveis.map((m) => {
                const Icon = m.icon
                const checked = metodo === m.id
                return (
                  <Label
                    key={m.id}
                    htmlFor={`pgto-${m.id}`}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      checked
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem
                      value={m.id}
                      id={`pgto-${m.id}`}
                      className="mt-0.5"
                    />
                    <Icon
                      className={cn(
                        'size-5 shrink-0 mt-0.5',
                        checked ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {m.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.descricao}
                      </p>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>
          )}

          <Button
            className="w-full btn-brand h-11"
            disabled={!metodo || criando}
            onClick={() => {
              if (!metodo) return
              if (metodo === 'pix') {
                void criarPagamento('pix')
                return
              }
              setDadosAberto(true)
            }}
          >
            {criando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Processando...
              </>
            ) : (
              <>
                <ArrowRight className="size-4" /> Continuar para pagamento
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          {metodo === 'pix' && (
            <PixView
              pagamento={pagamento}
              tempoRestante={tempoRestante}
              formatarTempo={formatarTempo}
              copiado={copiado}
              onCopiar={copiarCodigo}
              simulado={pagamento.simulado}
            />
          )}

          {metodo === 'cartao' && (
            <CartaoProcessadoView pagamento={pagamento} />
          )}

          {metodo === 'boleto' && (
            <BoletoView
              pagamento={pagamento}
              copiado={copiado}
              onCopiar={copiarCodigo}
            />
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Aguardando confirmação do Mercado Pago...</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs"
            disabled={criando}
            onClick={() => {
              setPagamento(null)
              setStatus(null)
              setTempoEsgotado(false)
              setDadosAberto(false)
              if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
              }
            }}
          >
            Trocar método de pagamento
          </Button>
        </>
      )}

      {onCancelar && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs"
          onClick={onCancelar}
        >
          Cancelar checkout
        </Button>
      )}
    </div>
  )
}

// ---------- Sub-componentes ----------

function PixView({
  pagamento,
  tempoRestante,
  formatarTempo,
  copiado,
  onCopiar,
  simulado,
}: {
  pagamento: PagamentoCriarResposta
  tempoRestante: number | null
  formatarTempo: (ms: number) => string
  copiado: boolean
  onCopiar: (codigo: string) => void
  simulado: boolean
}) {
  const qrSrc = pagamento.qrCodeBase64 || pagamento.qrCode
  const codigo = pagamento.pixCopiaECola || ''

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="size-5 text-primary" />
            <p className="font-semibold text-sm">Pague com PIX</p>
          </div>
          {tempoRestante !== null && tempoRestante > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              <Clock className="size-3 mr-1" />
              {formatarTempo(tempoRestante)}
            </Badge>
          )}
        </div>

        {simulado && (
          <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Modo simulado: o QR abaixo é fictício. Será aprovado automaticamente em 10s.
            </span>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 py-2">
          {qrSrc ? (
            <div className="size-56 bg-white border border-border rounded-lg p-2 flex items-center justify-center">
              <img
                src={qrSrc}
                alt="QR Code PIX"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="size-56 bg-muted rounded-lg flex items-center justify-center">
              <QrCodeIcon className="size-12 text-muted-foreground/50" />
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Escaneie o QR Code com o app do seu banco
          </p>
        </div>

        {codigo && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Ou copie o código PIX
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 p-2 bg-muted rounded text-[11px] font-mono break-all">
                {codigo}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-auto shrink-0"
                onClick={() => onCopiar(codigo)}
              >
                {copiado ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type MercadoPagoCardPayload = {
  token: string
  paymentMethodId: string
  paymentTypeId: string
  installments: number
  payer: {
    email: string
    identification?: {
      type?: string
      number?: string
    }
  }
}

declare global {
  interface Window {
    MercadoPago?: any
    cardPaymentBrickController?: any
  }
}

function carregarMercadoPagoJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.MercadoPago) return Promise.resolve()

  const existente = document.querySelector<HTMLScriptElement>(
    'script[data-matilha-mercado-pago="true"]'
  )

  if (existente) {
    return new Promise((resolve, reject) => {
      if (window.MercadoPago) return resolve()
      existente.addEventListener('load', () => resolve(), { once: true })
      existente.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar MercadoPago.js')),
        { once: true }
      )
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.dataset.matilhaMercadoPago = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar MercadoPago.js'))
    document.head.appendChild(script)
  })
}

function CartaoTransparente({
  vendaId,
  total,
  publicKey,
  criando,
  onSubmit,
  onVoltar,
}: {
  vendaId: string
  total: number
  publicKey: string
  criando: boolean
  onSubmit: (card: MercadoPagoCardPayload) => Promise<PagamentoCriarResposta>
  onVoltar: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const onSubmitRef = useRef(onSubmit)
  const containerId = `cardPaymentBrick_${vendaId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    let ativo = true
    let controller: any = null

    if (!publicKey) {
      setErro(
        'Public Key do Mercado Pago não configurada. Adicione NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY na Vercel.'
      )
      return
    }

    ;(async () => {
      try {
        await carregarMercadoPagoJs()
        if (!ativo || !window.MercadoPago) return

        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
        const bricksBuilder = mp.bricks()

        controller = await bricksBuilder.create(
          'cardPayment',
          containerId,
          {
            initialization: {
              amount: Number(total.toFixed(2)),
            },
            callbacks: {
              onReady: () => {
                if (ativo) setErro(null)
              },
              onSubmit: (formData: any, additionalData: any) => {
                return new Promise<void>(async (resolve, reject) => {
                  try {
                    const card: MercadoPagoCardPayload = {
                      token: formData.token,
                      paymentMethodId: formData.payment_method_id,
                      paymentTypeId:
                        additionalData?.paymentTypeId || 'credit_card',
                      installments: Number(formData.installments || 1),
                      payer: {
                        email: formData.payer?.email,
                        identification: formData.payer?.identification,
                      },
                    }

                    await onSubmitRef.current(card)
                    resolve()
                  } catch (e) {
                    reject(e)
                  }
                })
              },
              onError: (e: any) => {
                console.error('[MercadoPago Brick] erro:', e)
                if (ativo) {
                  setErro(
                    'Não foi possível carregar ou processar o formulário do cartão.'
                  )
                }
              },
            },
          }
        )

        window.cardPaymentBrickController = controller
      } catch (e: any) {
        console.error('[CartaoTransparente] erro:', e)
        if (ativo) setErro(e?.message || 'Erro ao carregar pagamento com cartão')
      }
    })()

    return () => {
      ativo = false
      try {
        controller?.unmount?.()
      } catch {}
      if (window.cardPaymentBrickController === controller) {
        window.cardPaymentBrickController = undefined
      }
    }
  }, [containerId, publicKey, total])

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <div>
            <p className="font-semibold text-sm">Cartão de crédito</p>
            <p className="text-xs text-muted-foreground">
              Checkout Transparente — você continua no Matilha Prado.
            </p>
          </div>
        </div>

        {erro && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded p-2">
            {erro}
          </div>
        )}

        <div id={containerId} className={cn(criando && 'pointer-events-none opacity-60')} />

        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <span>🔒 Dados do cartão tokenizados diretamente pelo Mercado Pago</span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={criando}
          onClick={onVoltar}
        >
          Voltar aos métodos de pagamento
        </Button>
      </CardContent>
    </Card>
  )
}

function CartaoProcessadoView({
  pagamento,
}: {
  pagamento: PagamentoCriarResposta
}) {
  useEffect(() => {
    if (!pagamento.challengeUrl) return

    const listener = (event: MessageEvent) => {
      if (event?.data?.status === 'COMPLETE') {
        toast.info('Autenticação do banco concluída. Confirmando pagamento...')
      }
    }

    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [pagamento.challengeUrl])

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <p className="font-semibold text-sm">Pagamento com cartão</p>
        </div>

        {pagamento.challengeUrl ? (
          <>
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2">
              Seu banco solicitou uma autenticação adicional (3DS). Conclua abaixo sem sair do site.
            </div>
            <iframe
              src={pagamento.challengeUrl}
              title="Autenticação 3DS do cartão"
              className="w-full min-h-[420px] rounded-lg border bg-white"
              allow="payment"
            />
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            Pagamento enviado com segurança ao Mercado Pago. Estamos confirmando o status.
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          🔒 O Matilha Prado não recebe nem armazena número ou CVV do cartão.
        </p>
      </CardContent>
    </Card>
  )
}

type BoletoPayload = {
  email: string
  firstName: string
  lastName: string
  identification: { type: string; number: string }
  address: {
    zipCode: string
    streetName: string
    streetNumber: string
    neighborhood: string
    city: string
    state: string
  }
}

function BoletoForm({
  criando,
  onSubmit,
  onVoltar,
}: {
  criando: boolean
  onSubmit: (boleto: BoletoPayload) => Promise<PagamentoCriarResposta>
  onVoltar: () => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    cpf: '',
    cep: '',
    streetName: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    state: '',
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()

    const cpf = form.cpf.replace(/\D/g, '')
    const cep = form.cep.replace(/\D/g, '')

    if (cpf.length !== 11) {
      toast.error('Informe um CPF válido para gerar o boleto')
      return
    }

    if (cep.length !== 8) {
      toast.error('Informe um CEP válido')
      return
    }

    await onSubmit({
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      identification: {
        type: 'CPF',
        number: cpf,
      },
      address: {
        zipCode: cep,
        streetName: form.streetName.trim(),
        streetNumber: form.streetNumber.trim() || 'S/N',
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      },
    })
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form className="space-y-3" onSubmit={enviar}>
          <div className="flex items-center gap-2">
            <Barcode className="size-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Gerar boleto</p>
              <p className="text-xs text-muted-foreground">
                Dados exigidos pelo Mercado Pago para emissão.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              required
              placeholder="Nome"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
            <Input
              required
              placeholder="Sobrenome"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </div>

          <Input
            required
            type="email"
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              required
              inputMode="numeric"
              placeholder="CPF"
              value={form.cpf}
              onChange={(e) => set('cpf', e.target.value)}
            />
            <Input
              required
              inputMode="numeric"
              placeholder="CEP"
              value={form.cep}
              onChange={(e) => set('cep', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <Input
              required
              placeholder="Rua"
              value={form.streetName}
              onChange={(e) => set('streetName', e.target.value)}
            />
            <Input
              required
              placeholder="Número"
              value={form.streetNumber}
              onChange={(e) => set('streetNumber', e.target.value)}
            />
          </div>

          <Input
            required
            placeholder="Bairro"
            value={form.neighborhood}
            onChange={(e) => set('neighborhood', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2">
            <Input
              required
              placeholder="Cidade"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <Input
              required
              maxLength={2}
              placeholder="UF"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full btn-brand h-11"
            disabled={criando}
          >
            {criando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando boleto...
              </>
            ) : (
              <>
                <Barcode className="size-4" /> Gerar boleto
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={criando}
            onClick={onVoltar}
          >
            Voltar aos métodos de pagamento
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function BoletoView({
  pagamento,
  copiado,
  onCopiar,
}: {
  pagamento: PagamentoCriarResposta
  copiado: boolean
  onCopiar: (codigo: string) => void
}) {
  const abrirBoleto = () => {
    if (!pagamento.boletoUrl) {
      toast.error('URL do boleto indisponível')
      return
    }
    window.open(pagamento.boletoUrl, '_blank', 'noopener,noreferrer')
  }

  const codigo =
    pagamento.boletoLinhaDigitavel ||
    pagamento.boletoCodigoBarras ||
    ''

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Barcode className="size-5 text-primary" />
          <p className="font-semibold text-sm">Boleto bancário</p>
        </div>

        <p className="text-xs text-muted-foreground">
          O boleto é emitido pelo Mercado Pago e normalmente vence em 3 dias úteis.
        </p>

        {codigo && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Linha digitável
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 p-2 bg-muted rounded text-[11px] font-mono break-all">
                {codigo}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-auto shrink-0"
                onClick={() => onCopiar(codigo)}
              >
                {copiado ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        <Button
          className="w-full btn-brand h-11"
          onClick={abrirBoleto}
          disabled={!pagamento.boletoUrl}
        >
          <ExternalLink className="size-4" /> Abrir boleto
        </Button>
      </CardContent>
    </Card>
  )
}
