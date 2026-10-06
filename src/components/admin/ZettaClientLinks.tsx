'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type LinkSummary = {
  linkedNow: number
  linkedTotal: number
  pending: number
  ambiguous: number
  notFound: number
}

export function ZettaClientLinks() {
  const [summary, setSummary] = useState<LinkSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const synchronize = useCallback(async (showToast = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/zetta/vinculos', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível vincular as contas automaticamente.')
      }

      setSummary({
        linkedNow: Number(data.linkedNow || 0),
        linkedTotal: Number(data.linkedTotal || 0),
        pending: Number(data.pending || 0),
        ambiguous: Number(data.ambiguous || 0),
        notFound: Number(data.notFound || 0),
      })

      if (showToast) {
        toast.success(
          data.linkedNow > 0
            ? `${data.linkedNow} conta(s) vinculada(s) automaticamente.`
            : 'Vínculos já estão atualizados.'
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar vínculos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void synchronize(false)
  }, [synchronize])

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4 text-primary" />
              Vínculo automático portal ↔ Zetta
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              O sistema compara o nome da conta do portal com o nome do cliente no Zetta e vincula sozinho quando existe uma correspondência única.
            </p>
          </div>
          <Badge variant="outline">
            {loading && !summary ? 'Sincronizando...' : `${summary?.linkedTotal || 0} vinculada(s)`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {loading && !summary ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Conferindo nomes automaticamente...
            </span>
          ) : summary ? (
            <span>
              {summary.linkedNow > 0
                ? `${summary.linkedNow} novo(s) vínculo(s) criado(s). `
                : 'Vínculos conferidos. '}
              {summary.pending > 0
                ? `${summary.pending} conta(s) ficaram sem vínculo automático para evitar associar clientes errados.`
                : 'Todas as contas compatíveis estão vinculadas.'}
            </span>
          ) : (
            'Aguardando sincronização.'
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void synchronize(true)}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Conferir novamente
        </Button>
      </CardContent>
    </Card>
  )
}
