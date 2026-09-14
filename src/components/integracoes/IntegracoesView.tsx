'use client'

import { useEffect, useState } from 'react'
import { Plug, RefreshCw, CheckCircle2, XCircle, CreditCard, Truck, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Integracao } from '@/lib/types'

/**
 * IntegracoesView - Painel de integrações
 *
 * IMPORTANTE: As integrações com Mercado Livre e Amazon NÃO são exibidas aqui.
 * Elas são configuradas diretamente no código (variáveis de ambiente + APIs),
 * pois exigem credenciais sensíveis e processos de aprovação dos marketplaces.
 *
 * Este painel mostra apenas integrações ativas que NÃO são marketplaces,
 * como: Mercado Pago (pagamento), Correios (frete), etc.
 *
 * Para ativar ML/Amazon, o desenvolvedor deve:
 * 1. Obter as credenciais dos marketplaces
 * 2. Configurar no código (variáveis de ambiente)
 * 3. Implementar a sincronização na API
 */
export function IntegracoesView() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const res = await fetch('/api/integracoes', { credentials: 'same-origin' })
        if (res.ok && !cancelado) {
          const data = await res.json()
          // Filtrar: só mostrar integrações que NÃO sejam mercado_livre ou amazon
          // (essas são configuradas no código, não pelo admin)
          const visiveis = (data as Integracao[]).filter(
            (i) => i.plataforma !== 'mercado_livre' && i.plataforma !== 'amazon'
          )
          setIntegracoes(visiveis)
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Serviços conectados ao sistema
        </p>
      </div>

      {/* Aviso sobre ML/Amazon */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex gap-3">
          <Info className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 mb-1">
              Sobre Mercado Livre e Amazon
            </p>
            <p className="text-blue-800 text-xs leading-relaxed">
              As integrações com marketplaces (Mercado Livre e Amazon) são configuradas
              diretamente no código pelo desenvolvedor, pois exigem credenciais de API
              específicas e processo de aprovação de cada plataforma. Se você precisa
              integrar com esses marketplaces, entre em contato com o desenvolvedor.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integrações disponíveis (não marketplaces) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mercado Pago (se ativo) */}
        <Card className={integracoes.some((i) => i.plataforma === 'mercado_pago') ? 'border-green-300' : ''}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="size-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Mercado Pago</CardTitle>
                  <CardDescription className="text-xs">Gateway de pagamento</CardDescription>
                </div>
              </div>
              <Badge variant={integracoes.some((i) => i.plataforma === 'mercado_pago') ? 'default' : 'secondary'}>
                {integracoes.some((i) => i.plataforma === 'mercado_pago') ? (
                  <><CheckCircle2 className="size-3 mr-1" /> Ativo</>
                ) : (
                  <><XCircle className="size-3 mr-1" /> Inativo</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {integracoes.find((i) => i.plataforma === 'mercado_pago') ? (
              <p>Configurado em: {integracoes.find((i) => i.plataforma === 'mercado_pago')?.domain || 'Mercado Pago'}</p>
            ) : (
              <p>Configure na aba "Pagamentos" do menu lateral.</p>
            )}
          </CardContent>
        </Card>

        {/* Correios (se ativo) */}
        <Card className={integracoes.some((i) => i.plataforma === 'correios') ? 'border-green-300' : ''}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Truck className="size-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Correios (Sedex)</CardTitle>
                  <CardDescription className="text-xs">Cálculo de frete</CardDescription>
                </div>
              </div>
              <Badge variant={integracoes.some((i) => i.plataforma === 'correios') ? 'default' : 'secondary'}>
                {integracoes.some((i) => i.plataforma === 'correios') ? (
                  <><CheckCircle2 className="size-3 mr-1" /> Ativo</>
                ) : (
                  <><XCircle className="size-3 mr-1" /> Inativo</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>Sedex para entregas fora de SP. Configure os valores na aba "Entregas".</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de integrações ativas (se houver outras) */}
      {integracoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outras Integrações Ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {integracoes.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Plug className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{i.plataforma.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {i.ultimaSync && (
                    <span className="text-xs text-muted-foreground">
                      Última sync: {format(parseISO(i.ultimaSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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

      {!loading && integracoes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Plug className="size-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              Nenhuma integração ativa além do Mercado Pago e Correios.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Para integrar com Mercado Livre ou Amazon, contate o desenvolvedor.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
