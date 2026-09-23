'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Invitation = { id: string; nome: string; email: string; expiresAt: string; usedAt: string | null; revokedAt: string | null; emailStatus: string }
export function ClientInvitationHistory() {
  const [items, setItems] = useState<Invitation[]>([])
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(() => fetch('/api/admin/convites-clientes', { cache: 'no-store' })
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível consultar os convites.')
      setItems(data.invitations); setConfigured(data.configured); setError('')
    }).catch((e) => { setError(e instanceof Error ? e.message : 'Falha ao consultar convites.') })
    .finally(() => setLoading(false)), [])
  useEffect(() => {
    void load()
    const update = () => { void load() }
    window.addEventListener('client-invitations:changed', update)
    return () => window.removeEventListener('client-invitations:changed', update)
  }, [load])
  async function revoke(id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/convites-clientes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível revogar.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao revogar.') }
    finally { setBusy(null) }
  }
  return <Card><CardContent className="p-4 sm:p-6 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">Convites de acesso dos clientes</h2><p className="text-sm text-muted-foreground">Selecione “Convidar para o portal” no cadastro abaixo. Últimos 100 convites.</p></div><Button variant="outline" onClick={() => void load()}>Atualizar</Button></div>
    {loading ? <p role="status">Consultando convites...</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <>
      {!configured && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Envio ainda não configurado. Defina RESEND_API_KEY, INVITATION_EMAIL_FROM e APP_URL com HTTPS no servidor.</p>}
      <p className="text-xs text-muted-foreground">“Aceito pelo provedor” não confirma entrega na caixa de entrada. Confira falhas e devoluções no serviço de e-mail.</p>
      <div className="max-h-80 overflow-y-auto space-y-2">{items.length === 0 ? <p className="text-sm">Nenhum convite gerado.</p> : items.map((item) => {
        const expired = new Date(item.expiresAt) <= new Date()
        const status = item.usedAt ? 'Acesso ativado' : item.revokedAt ? 'Revogado' : expired ? 'Expirado' : item.emailStatus === 'accepted' ? 'Aceito pelo provedor' : item.emailStatus === 'unknown' ? 'Envio não confirmado' : 'Envio em processamento'
        return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="font-medium text-sm">{item.nome}</p><p className="text-sm break-all">{item.email}</p><p className="text-xs text-muted-foreground">{status} · Válido até {new Date(item.expiresAt).toLocaleString('pt-BR')}</p></div>{!item.usedAt && !item.revokedAt && !expired && <Button variant="outline" disabled={Boolean(busy)} onClick={() => void revoke(item.id)}>Revogar</Button>}</div>
      })}</div>
    </>}
  </CardContent></Card>
}
