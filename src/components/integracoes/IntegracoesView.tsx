'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plug,
  CheckCircle2,
  XCircle,
  CreditCard,
  Bike,
  Info,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Package,
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
import { toast } from 'sonner'

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
type MercadoLivreItem = {
  id: string
  title: string
  price: number | null
  currency: string
  quantity: number
  status: string
  permalink: string | null
  thumbnail: string | null
  imported: boolean
  published: boolean
  productId: string | null
}
type MercadoLivreItems = { items: MercadoLivreItem[]; page: number; total: number }

type AmazonStatus = {
  configured: boolean
  connected: boolean
  catalogAccess: boolean
  sellerId: string | null
  marketplaceId: string
  lastSync?: string | null
  missing?: string[]
  error?: string | null
  errorCode?: string | null
}
type AmazonItem = {
  sku: string
  asin: string | null
  title: string
  price: number | null
  currency: string
  quantity: number
  status: string[]
  imageUrl: string | null
  productType: string | null
  imported: boolean
  published: boolean
  productId: string | null
}
type AmazonItems = {
  items: AmazonItem[]
  page: number
  total: number
  truncated?: boolean
}

function mercadoLivreOAuthErrorMessage(code: string | null) {
  const messages: Record<string, string> = {
    invalid_client: 'Client ID ou Client Secret inválido. Confirme que são da aplicação Mercado Livre, não da aplicação Mercado Pago.',
    invalid_grant: 'A autorização expirou, já foi usada ou não corresponde à Redirect URI configurada. Reconecte a conta.',
    invalid_request: 'O Mercado Livre rejeitou os parâmetros do OAuth. Confira Redirect URI e a opção PKCE do aplicativo.',
    invalid_scope: 'Os escopos/permissões do aplicativo Mercado Livre estão incompatíveis.',
    forbidden: 'O Mercado Livre bloqueou o acesso. Confira a conta vendedora, permissões e situação do aplicativo.',
    unauthorized_client: 'A aplicação não tem autorização para gerar token para esta conta.',
    unauthorized_application: 'A aplicação Mercado Livre está bloqueada ou indisponível.',
    invalid_operator_user_id: 'A autorização precisa ser feita pela conta principal/administradora do Mercado Livre, não por colaborador.',
    access_denied: 'A autorização foi negada no Mercado Livre.',
  }
  return messages[code || ''] || 'A autorização do Mercado Livre falhou. Confira as credenciais do aplicativo e tente novamente.'
}

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
  const [mlSyncing, setMlSyncing] = useState(false)
  const [mlRefresh, setMlRefresh] = useState(0)
  const [mlPublishingId, setMlPublishingId] = useState<string | null>(null)
  const mlAutoSyncDone = useRef(false)

  const [amazon, setAmazon] = useState<AmazonStatus | null>(null)
  const [amazonItems, setAmazonItems] = useState<AmazonItems | null>(null)
  const [amazonPage, setAmazonPage] = useState(1)
  const [amazonLoading, setAmazonLoading] = useState(false)
  const [amazonError, setAmazonError] = useState('')
  const [amazonSyncing, setAmazonSyncing] = useState(false)
  const [amazonRefresh, setAmazonRefresh] = useState(0)
  const [amazonPublishingId, setAmazonPublishingId] = useState<string | null>(null)
  const amazonAutoSyncDone = useRef(false)

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
  }, [mercadoLivre?.connected, mlPage, mlRefresh])

  useEffect(() => {
    if (!amazon?.connected) return
    const controller = new AbortController()

    async function loadAmazonItems() {
      setAmazonLoading(true)
      setAmazonError('')
      try {
        const response = await fetch(
          `/api/integracoes/amazon/itens?page=${amazonPage}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          }
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(
            data?.error || 'Não foi possível buscar os anúncios da Amazon.'
          )
        }
        setAmazonItems(data as AmazonItems)
      } catch (error) {
        if (!controller.signal.aborted) {
          setAmazonError(
            error instanceof Error
              ? error.message
              : 'Não foi possível buscar os anúncios da Amazon.'
          )
        }
      } finally {
        if (!controller.signal.aborted) setAmazonLoading(false)
      }
    }

    void loadAmazonItems()
    return () => controller.abort()
  }, [amazon?.connected, amazonPage, amazonRefresh])

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const [pagamentoRes, freteRes, integracoesRes, bridgeRes, mlRes, amazonRes] = await Promise.all([
          fetch('/api/pagamento/config', { credentials: 'same-origin' }),
          fetch('/api/frete/config', { credentials: 'same-origin' }),
          fetch('/api/integracoes', { credentials: 'same-origin' }),
          fetch('/api/admin/integration-bridge/status', { credentials: 'same-origin', cache: 'no-store' }),
          fetch('/api/integracoes/mercado-livre/status', { credentials: 'same-origin', cache: 'no-store' }),
          fetch('/api/integracoes/amazon/status', { credentials: 'same-origin', cache: 'no-store' }),
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
        const amazonStatus: AmazonStatus | null = await amazonRes.json().catch(() => null)

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
          setAmazon(amazonStatus)

          if (
            amazonStatus?.connected &&
            !amazonStatus.lastSync &&
            !amazonAutoSyncDone.current
          ) {
            amazonAutoSyncDone.current = true
            void fetch('/api/integracoes/amazon/sincronizar', {
              method: 'POST',
              credentials: 'same-origin',
            })
              .then(async (response) => {
                const payload = await response.json().catch(() => ({}))
                if (!response.ok) {
                  throw new Error(
                    payload?.error ||
                      'Amazon conectada, mas não foi possível puxar o catálogo.'
                  )
                }
                toast.success(
                  `Amazon conectada: ${payload.synchronized || 0} anúncio(s) sincronizado(s).`
                )
                if (payload.created) {
                  toast.info(
                    'Os novos produtos da Amazon foram importados ocultos.'
                  )
                }
                setAmazonRefresh((value) => value + 1)
              })
              .catch((error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'A sincronização automática da Amazon falhou.'
                )
              })
          }

          const oauthResult = new URLSearchParams(window.location.search).get('ml')
          if (
            mlStatus?.connected &&
            oauthResult === 'connected' &&
            !mlAutoSyncDone.current
          ) {
            mlAutoSyncDone.current = true
            void fetch('/api/integracoes/mercado-livre/sincronizar', {
              method: 'POST',
              credentials: 'same-origin',
            })
              .then(async (response) => {
                const payload = await response.json().catch(() => ({}))
                if (!response.ok) {
                  throw new Error(
                    payload?.error ||
                      'Conta conectada, mas não foi possível puxar os anúncios.'
                  )
                }
                toast.success(
                  `Mercado Livre conectado: ${payload.synchronized || 0} anúncio(s) puxado(s) automaticamente.`
                )
                if (payload.created) {
                  toast.info(
                    'Os novos produtos foram importados ocultos. Publique somente os que quiser exibir.'
                  )
                }
                setMlRefresh((value) => value + 1)
              })
              .catch((error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Conta conectada, mas a sincronização automática falhou.'
                )
              })
          }
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

  const sincronizarMercadoLivre = async () => {
    if (mlSyncing) return

    setMlSyncing(true)
    try {
      const response = await fetch('/api/integracoes/mercado-livre/sincronizar', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível sincronizar o catálogo.')
      }

      toast.success(
        `Mercado Livre sincronizado: ${data.created || 0} novo(s) e ${data.updated || 0} atualizado(s).`
      )
      if (data.created) {
        toast.info('Os novos produtos foram importados ocultos. Publique apenas os que quiser exibir.')
      }
      setMlRefresh((value) => value + 1)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível sincronizar o Mercado Livre.'
      )
    } finally {
      setMlSyncing(false)
    }
  }

  const alterarPublicacaoMercadoLivre = async (
    item: MercadoLivreItem,
    publicar: boolean
  ) => {
    if (!item.productId || mlPublishingId) return

    setMlPublishingId(item.id)
    try {
      const response = await fetch(`/api/produtos/${item.productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ativo: publicar }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível alterar a publicação.')
      }

      toast.success(
        publicar
          ? `${item.title} publicado na vitrine.`
          : `${item.title} ocultado da vitrine.`
      )
      setMlRefresh((value) => value + 1)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a publicação.'
      )
    } finally {
      setMlPublishingId(null)
    }
  }

  const sincronizarAmazon = async () => {
    if (amazonSyncing) return

    setAmazonSyncing(true)
    try {
      const response = await fetch('/api/integracoes/amazon/sincronizar', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data?.error || 'Não foi possível sincronizar o catálogo Amazon.'
        )
      }

      toast.success(
        `Amazon sincronizada: ${data.created || 0} novo(s) e ${data.updated || 0} atualizado(s).`
      )
      if (data.created) {
        toast.info(
          'Os novos produtos da Amazon foram importados ocultos. Publique apenas os que quiser exibir.'
        )
      }
      setAmazonRefresh((value) => value + 1)
      setAmazon((current) =>
        current
          ? { ...current, lastSync: new Date().toISOString() }
          : current
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível sincronizar a Amazon.'
      )
    } finally {
      setAmazonSyncing(false)
    }
  }

  const alterarPublicacaoAmazon = async (
    item: AmazonItem,
    publicar: boolean
  ) => {
    if (!item.productId || amazonPublishingId) return

    setAmazonPublishingId(item.sku)
    try {
      const response = await fetch(`/api/produtos/${item.productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ativo: publicar }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível alterar a publicação.')
      }

      toast.success(
        publicar
          ? `${item.title} publicado na vitrine.`
          : `${item.title} ocultado da vitrine.`
      )
      setAmazonRefresh((value) => value + 1)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a publicação.'
      )
    } finally {
      setAmazonPublishingId(null)
    }
  }

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Mercado Livre</CardTitle>
              <CardDescription>
                Sincronize os anúncios, revise os produtos e escolha o que aparece para os clientes.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={mercadoLivre?.connected ? 'default' : 'secondary'}>
                {mercadoLivre?.connected ? 'Conectado' : 'Pendente'}
              </Badge>
              {mercadoLivre?.connected && (
                <Button
                  size="sm"
                  onClick={sincronizarMercadoLivre}
                  disabled={mlSyncing}
                >
                  <RefreshCw className={`size-4 ${mlSyncing ? 'animate-spin' : ''}`} />
                  {mlSyncing ? 'Sincronizando...' : 'Sincronizar catálogo'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {mercadoLivre?.connected && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Conta vendedora: {mercadoLivre.sellerId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Novos anúncios entram no catálogo como <strong>ocultos</strong>. Use “Publicar”
                somente nos itens que devem aparecer na loja e na vitrine pública.
              </p>
            </div>
          )}

          {mercadoLivre?.tokenExpired && (
            <p className="text-amber-700">
              O token expirou. A integração tentará renovar automaticamente antes da próxima consulta.
            </p>
          )}
          {!mercadoLivre?.configured && (
            <p className="text-amber-700">
              Configure as variáveis do Mercado Livre na Vercel para habilitar a conexão.
            </p>
          )}
          {mercadoLivre && !mercadoLivre.databaseReady && (
            <p className="text-amber-700">
              {mercadoLivre.error || 'Banco da integração indisponível.'}
            </p>
          )}
          {!mercadoLivre && !loading && (
            <p className="text-amber-700">
              Não foi possível consultar o status da integração.
            </p>
          )}
          {mercadoLivre?.configured &&
            mercadoLivre.databaseReady &&
            !mercadoLivre.connected && (
              <p className="text-muted-foreground">
                Aplicação configurada. Falta autorizar a conta vendedora.
              </p>
            )}

          {typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('ml') === 'error' && (
              <p className="text-red-700">
                {mercadoLivreOAuthErrorMessage(
                  new URLSearchParams(window.location.search).get('ml_code')
                )}
              </p>
            )}

          {mercadoLivre?.configured && mercadoLivre.databaseReady ? (
            <Button asChild variant={mercadoLivre.connected ? 'outline' : 'default'}>
              <a href="/api/integracoes/mercado-livre/conectar">
                {mercadoLivre.connected
                  ? 'Reconectar Mercado Livre'
                  : 'Conectar Mercado Livre'}
              </a>
            </Button>
          ) : (
            <Button disabled>Conectar Mercado Livre</Button>
          )}

          {mercadoLivre?.connected && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    Anúncios da conta ({mlItems?.total ?? '…'})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Imagem, preço e estoque vêm do Mercado Livre.
                  </p>
                </div>
                {mlItems?.items.some((item) => item.imported) && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">
                      {mlItems.items.filter((item) => item.imported).length} importado(s)
                    </Badge>
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      {mlItems.items.filter((item) => item.published).length} publicado(s)
                    </Badge>
                  </div>
                )}
              </div>

              {mlLoading && (
                <p className="text-muted-foreground">Carregando anúncios...</p>
              )}
              {mlError && (
                <p role="alert" className="text-red-700">
                  {mlError}
                </p>
              )}
              {!mlLoading && !mlError && mlItems?.items.length === 0 && (
                <p className="text-muted-foreground">
                  Nenhum anúncio encontrado nesta conta.
                </p>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {mlItems?.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package className="size-8 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium leading-snug">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {item.id} · Estoque: {item.quantity}
                          </p>
                        </div>
                        <strong className="shrink-0 text-sm">
                          {item.price == null
                            ? 'Preço indisponível'
                            : new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: item.currency,
                              }).format(item.price)}
                        </strong>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {item.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            item.imported
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'text-muted-foreground'
                          }
                        >
                          {item.imported ? 'Importado' : 'Aguardando sync'}
                        </Badge>
                        {item.imported && (
                          <Badge
                            variant="outline"
                            className={
                              item.published
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }
                          >
                            {item.published ? 'Publicado' : 'Oculto'}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.imported && item.productId && (
                          <Button
                            size="sm"
                            variant={item.published ? 'outline' : 'default'}
                            disabled={mlPublishingId === item.id}
                            onClick={() =>
                              alterarPublicacaoMercadoLivre(item, !item.published)
                            }
                          >
                            {item.published ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                            {item.published ? 'Ocultar' : 'Publicar'}
                          </Button>
                        )}

                        {item.permalink && (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={item.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ver no Mercado Livre
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {mlItems && mlItems.total > 20 && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mlPage === 1 || mlLoading}
                    onClick={() => setMlPage((page) => page - 1)}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {mlPage} de {Math.ceil(mlItems.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      mlPage >= Math.ceil(mlItems.total / 20) || mlLoading
                    }
                    onClick={() => setMlPage((page) => page + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={amazon?.connected ? 'border-green-300' : 'border-amber-300'}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Amazon</CardTitle>
              <CardDescription>
                Selling Partner API · Amazon Brasil
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={amazon?.connected ? 'default' : 'secondary'}>
                {amazon?.connected ? 'Conectado' : 'Pendente'}
              </Badge>
              {amazon?.connected && (
                <Button
                  size="sm"
                  onClick={sincronizarAmazon}
                  disabled={amazonSyncing}
                >
                  <RefreshCw
                    className={`size-4 ${amazonSyncing ? 'animate-spin' : ''}`}
                  />
                  {amazonSyncing ? 'Sincronizando...' : 'Sincronizar catálogo'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {amazon?.connected && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">
                Conta vendedora: {amazon.sellerId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marketplace Brasil: {amazon.marketplaceId}. Produtos novos entram
                como <strong>ocultos</strong> até você publicar.
              </p>
              {amazon.lastSync && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Última sincronização:{' '}
                  {format(parseISO(amazon.lastSync), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          )}

          {amazon && !amazon.configured && (
            <p className="text-amber-700">
              {amazon.error ||
                'Configure as variáveis da Amazon SP-API na Vercel.'}
            </p>
          )}

          {amazon?.configured && !amazon.connected && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <p className="font-medium">Não foi possível validar a Amazon.</p>
              <p className="mt-1 text-xs">
                {amazon.error ||
                  'Confira Client ID, Client Secret, Refresh Token, Seller ID e a função Product Listing.'}
              </p>
            </div>
          )}

          {!amazon && !loading && (
            <p className="text-amber-700">
              Não foi possível consultar o status da integração Amazon.
            </p>
          )}

          {amazon?.connected && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    Anúncios Amazon ({amazonItems?.total ?? '…'})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    SKU, ASIN, preço, estoque e imagem vêm da SP-API.
                  </p>
                </div>
                {amazonItems?.items.some((item) => item.imported) && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">
                      {amazonItems.items.filter((item) => item.imported).length}{' '}
                      importado(s)
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-green-200 bg-green-50 text-green-700"
                    >
                      {
                        amazonItems.items.filter((item) => item.published)
                          .length
                      }{' '}
                      publicado(s)
                    </Badge>
                  </div>
                )}
              </div>

              {amazonLoading && (
                <p className="text-muted-foreground">
                  Carregando anúncios da Amazon...
                </p>
              )}

              {amazonError && (
                <p role="alert" className="text-red-700">
                  {amazonError}
                </p>
              )}

              {!amazonLoading &&
                !amazonError &&
                amazonItems?.items.length === 0 && (
                  <p className="text-muted-foreground">
                    Nenhum anúncio encontrado nesta conta Amazon.
                  </p>
                )}

              <div className="grid gap-3 lg:grid-cols-2">
                {amazonItems?.items.map((item) => (
                  <div
                    key={`${item.asin || 'sem-asin'}-${item.sku}`}
                    className="flex min-w-0 gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package className="size-8 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium leading-snug">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            SKU: {item.sku}
                            {item.asin ? ` · ASIN: ${item.asin}` : ''}
                            {' · '}Estoque: {item.quantity}
                          </p>
                        </div>
                        <strong className="shrink-0 text-sm">
                          {item.price == null
                            ? 'Preço indisponível'
                            : new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: item.currency || 'BRL',
                              }).format(item.price)}
                        </strong>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(item.status.length ? item.status : ['SEM STATUS']).map(
                          (status) => (
                            <Badge
                              key={status}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {status}
                            </Badge>
                          )
                        )}
                        <Badge
                          variant="outline"
                          className={
                            item.imported
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'text-muted-foreground'
                          }
                        >
                          {item.imported ? 'Importado' : 'Aguardando sync'}
                        </Badge>
                        {item.imported && (
                          <Badge
                            variant="outline"
                            className={
                              item.published
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }
                          >
                            {item.published ? 'Publicado' : 'Oculto'}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.imported && item.productId && (
                          <Button
                            size="sm"
                            variant={item.published ? 'outline' : 'default'}
                            disabled={amazonPublishingId === item.sku}
                            onClick={() =>
                              alterarPublicacaoAmazon(item, !item.published)
                            }
                          >
                            {item.published ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                            {item.published ? 'Ocultar' : 'Publicar'}
                          </Button>
                        )}

                        {item.asin && (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`https://www.amazon.com.br/dp/${encodeURIComponent(
                                item.asin
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ver na Amazon
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {amazonItems && amazonItems.total > 20 && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={amazonPage === 1 || amazonLoading}
                    onClick={() => setAmazonPage((page) => page - 1)}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {amazonPage} de{' '}
                    {Math.ceil(amazonItems.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      amazonPage >= Math.ceil(amazonItems.total / 20) ||
                      amazonLoading
                    }
                    onClick={() => setAmazonPage((page) => page + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}

              {amazonItems?.truncated && (
                <p className="text-xs text-amber-700">
                  Foram carregados os primeiros 500 anúncios. Catálogos maiores
                  serão paginados em uma próxima evolução.
                </p>
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
