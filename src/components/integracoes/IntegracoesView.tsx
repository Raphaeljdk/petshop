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
import { Button } from '@/components/ui/button'
import type {
  ConfiguracaoFrete,
  ConfiguracaoPagamento,
  Integracao,
} from '@/lib/types'

type BridgeStatus = {
  reachable?: boolean
  bridge?: string | null
  siggmaApiConfigured?: boolean
  siggmaOrderWriteConfigured?: boolean
  zettaDatabaseConfigured?: boolean
}

type EstadoIntegracoes = {
  pagamento: ConfiguracaoPagamento | null
  frete: ConfiguracaoFrete | null
  outras: Integracao[]
  bridge: BridgeStatus | null
}

type MercadoLivreStatus = { configured: boolean; connected: boolean; databaseReady: boolean; sellerId: string | null; tokenExpired: boolean; error?: string }
type MercadoLivreItem = { id: string; title: string; price: number | null; currency: string; quantity: number; status: string; permalink: string | null }
type MercadoLivreItems = { items: MercadoLivreItem[]; page: number; total: number }

export function IntegracoesView() {
  const [estado, setEstado] = useState<EstadoIntegracoes>({
    pagamento: null,
    frete: null,
    outras: [],
    bridge: null,
  })
  const [loading, setLoading] = useState(true)
  const [mercadoLivre, setMercadoLivre] = useState<MercadoLivreStatus | null>(null)
  const [mlItems, setMlItems] = useState<MercadoLivreItems | null>(null)
  const [mlPage, setMlPage] = useState(1)
  const [mlLoading, setMlLoading] = useState(false)
  const [mlError, setMlError] = useState('')

  useEffect(() => {
    if (!mercadoLivre?.connected) return
    const controller = new AbortController()
    async function loadItems() {
      setMlLoading(true)
      setMlError('')
      try {
        const response = await fetch(`/api/integracoes/mercado-livre/itens?page=${mlPage}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível buscar os anúncios. Reconecte a conta se o problema continuar.')
        const data = await response.json() as MercadoLivreItems
        setMlItems(data)
      } catch {
        if (!controller.signal.aborted) setMlError('Não foi possível buscar os anúncios. Reconecte a conta se o problema continuar.')
      } finally {
        if (!controller.signal.aborted) setMlLoading(false)
      }
    }
    void loadItems()
    return () => controller.abort()
  }, [mercadoLivre?.connected, mlPage])

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const [pagamentoRes, freteRes, integracoesRes, bridgeRes, mlRes] = await Promise.all([
          fetch('/api/pagamento/config', { credentials: 'same-origin' }),
          fetch('/api/frete/config', { credentials: 'same-origin' }),
          fetch('/api/integracoes', { credentials: 'same-origin' }),
          fetch('/api/admin/integration-bridge/status', { credentials: 'same-origin', cache: 'no-store' }),
          fetch('/api/integracoes/mercado-livre/status', { credentials: 'same-origin', cache: 'no-store' }),
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
        const bridgePayload = bridgeRes.ok ? await bridgeRes.json() : null
        const bridge: BridgeStatus | null = bridgePayload?.bridge || null
        const mlStatus: MercadoLivreStatus | null = await mlRes.json().catch(() => null)

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
            bridge,
          })
          setMercadoLivre(mlStatus)
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

      <Card className={mercadoLivre?.connected ? 'border-green-300' : 'border-amber-300'}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Mercado Livre</CardTitle>
              <CardDescription>Autorize a conta vendedora para integrar seus anúncios.</CardDescription>
            </div>
            <Badge variant={mercadoLivre?.connected ? 'default' : 'secondary'}>{mercadoLivre?.connected ? 'Conectado' : 'Pendente'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {mercadoLivre?.connected && <p>Conta vendedora: {mercadoLivre.sellerId}</p>}
          {mercadoLivre?.tokenExpired && <p className="text-amber-700">O token de acesso expirou; a renovação será necessária antes de consultar anúncios.</p>}
          {!mercadoLivre?.configured && <p className="text-amber-700">Configure as variáveis do Mercado Livre na Vercel para habilitar a conexão.</p>}
          {mercadoLivre && !mercadoLivre.databaseReady && <p className="text-amber-700">{mercadoLivre.error || 'Banco da integração indisponível.'}</p>}
          {!mercadoLivre && !loading && <p className="text-amber-700">Não foi possível consultar o status da integração.</p>}
          {mercadoLivre?.configured && mercadoLivre.databaseReady && !mercadoLivre.connected && <p className="text-muted-foreground">Aplicação configurada. Falta autorizar a conta vendedora pelo botão abaixo.</p>}
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ml') === 'error' && <p className="text-red-700">A autorização falhou. Tente conectar novamente.</p>}
          {mercadoLivre?.configured && mercadoLivre.databaseReady ? (
            <Button asChild><a href="/api/integracoes/mercado-livre/conectar">{mercadoLivre.connected ? 'Reconectar Mercado Livre' : 'Conectar Mercado Livre'}</a></Button>
          ) : (
            <Button disabled>Conectar Mercado Livre</Button>
          )}
          {mercadoLivre?.connected && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">Anúncios da conta ({mlItems?.total ?? '…'})</h3>
              {mlLoading && <p className="text-muted-foreground">Carregando anúncios...</p>}
              {mlError && <p role="alert" className="text-red-700">{mlError}</p>}
              {!mlLoading && !mlError && mlItems?.items.length === 0 && <p className="text-muted-foreground">Nenhum anúncio encontrado nesta conta.</p>}
              <div className="divide-y rounded-md border">
                {mlItems?.items.map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.id} · {item.status} · Estoque: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong>{item.price == null ? 'Preço indisponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.price)}</strong>
                      {item.permalink && <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Ver anúncio</a>}
                    </div>
                  </div>
                ))}
              </div>
              {mlItems && mlItems.total > 20 && (
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" disabled={mlPage === 1 || mlLoading} onClick={() => setMlPage(page => page - 1)}>Anterior</Button>
                  <span>Página {mlPage} de {Math.ceil(mlItems.total / 20)}</span>
                  <Button variant="outline" size="sm" disabled={mlPage >= Math.ceil(mlItems.total / 20) || mlLoading} onClick={() => setMlPage(page => page + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={estado.bridge?.reachable ? 'border-green-300' : 'border-amber-300'}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Plug className="size-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">Siggma / Zetta</CardTitle>
                <CardDescription className="text-xs">
                  Bridge Oracle + ERP
                </CardDescription>
              </div>
            </div>
            <Badge variant={estado.bridge?.reachable ? 'default' : 'secondary'}>
              {estado.bridge?.reachable ? 'Online' : 'Verificar'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Bridge: <strong className="text-foreground">{estado.bridge?.reachable ? 'Online' : 'Indisponível'}</strong></p>
          <p>Banco Zetta: <strong className="text-foreground">{estado.bridge?.zettaDatabaseConfigured ? 'Conectado' : 'Pendente'}</strong></p>
          <p>API Siggma: <strong className="text-foreground">{estado.bridge?.siggmaApiConfigured ? 'Autenticada' : 'Pendente'}</strong></p>
          <p>Gravação de pedidos: <strong className={estado.bridge?.siggmaOrderWriteConfigured ? 'text-green-700' : 'text-amber-700'}>{estado.bridge?.siggmaOrderWriteConfigured ? 'Ativa' : 'Aguardando endpoint da Zetta'}</strong></p>
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
