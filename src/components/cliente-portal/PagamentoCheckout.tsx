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
  Download,
  ArrowRight,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
    }, 3000)
  }, [vendaId, onAprovado])

  // Iniciar pagamento quando método selecionado (não inicia automático —
  // espera clique do usuário, exceto PIX que já mostra QR ao selecionar)
  const criarPagamento = useCallback(
    async (metodoSel: MetodoPagamento) => {
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
          body: JSON.stringify({ vendaId, metodo: metodoSel }),
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
          toast.success('QR Code gerado')
        }
        iniciarPolling()
      } catch (e: any) {
        toast.error(e.message || 'Erro ao criar pagamento')
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

  const abrirCheckoutMP = () => {
    if (pagamento?.initPoint && pagamento.initPoint !== 'about:blank') {
      window.open(pagamento.initPoint, '_blank', 'noopener,noreferrer')
    } else if (pagamento?.simulado) {
      toast.info(
        'Modo simulado: o pagamento será aprovado automaticamente em 10s'
      )
    } else {
      toast.error('URL de checkout indisponível')
    }
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

      {/* Se ainda não tem pagamento criado, mostra opções */}
      {!pagamento ? (
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
              onValueChange={(v) => setMetodo(v as MetodoPagamento)}
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
            onClick={() => metodo && criarPagamento(metodo)}
          >
            {criando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando...
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
          {/* Mostra o conteúdo conforme o método */}
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
            <CartaoView
              pagamento={pagamento}
              onAbrirMP={abrirCheckoutMP}
            />
          )}

          {metodo === 'boleto' && (
            <BoletoView pagamento={pagamento} />
          )}

          {/* Polling indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Aguardando confirmação...</span>
          </div>

          {/* Botão trocar método */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs"
            disabled={criando}
            onClick={() => {
              setPagamento(null)
              setStatus(null)
              setTempoEsgotado(false)
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

function CartaoView({
  pagamento,
  onAbrirMP,
}: {
  pagamento: PagamentoCriarResposta
  onAbrirMP: () => void
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <p className="font-semibold text-sm">Pagamento com cartão</p>
        </div>

        {pagamento.simulado ? (
          <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Modo simulado ativo. O pagamento será aprovado automaticamente em 10 segundos.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Você será redirecionado para o ambiente seguro do Mercado Pago.
            Após concluir o pagamento, voltaremos automaticamente.
          </p>
        )}

        <Button
          className="w-full btn-brand h-11"
          onClick={onAbrirMP}
        >
          <ExternalLink className="size-4" />
          {pagamento.simulado
            ? 'Simular pagamento no Mercado Pago'
            : 'Pagar com Mercado Pago'}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          🔒 Pagamento processado pelo Mercado Pago
        </p>
      </CardContent>
    </Card>
  )
}

function BoletoView({ pagamento }: { pagamento: PagamentoCriarResposta }) {
  const baixarBoleto = () => {
    if (!pagamento.boletoUrl) {
      toast.info(
        'Modo simulado: o boleto será aprovado automaticamente em 10s'
      )
      return
    }
    // Boleto simulado — abre como download
    const a = document.createElement('a')
    a.href = pagamento.boletoUrl
    a.download = `boleto-matilha-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Boleto gerado!')
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Barcode className="size-5 text-primary" />
          <p className="font-semibold text-sm">Pagamento com boleto</p>
        </div>

        {pagamento.simulado && (
          <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Modo simulado: o boleto será aprovado automaticamente em 10 segundos.
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          O boleto vence em 3 dias. Após o pagamento, a compensação leva 1-2
          dias úteis.
        </p>

        <Button
          className="w-full btn-brand h-11"
          onClick={baixarBoleto}
        >
          <Download className="size-4" /> Gerar boleto
        </Button>
      </CardContent>
    </Card>
  )
}
