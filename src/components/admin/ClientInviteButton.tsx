'use client'
import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ClientInviteButton({ id, nome, email, disabled }: { id: number; nome: string; email: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [activationLink, setActivationLink] = useState('')
  async function send() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/admin/convites-clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siggmaCliCod: id, expectedEmail: email.trim().toLowerCase() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar o convite.')
      setSuccess(true); setMessage(data.message); setActivationLink(data.activationLink || '')
      window.dispatchEvent(new Event('client-invitations:changed'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha de conexão. Consulte o histórico antes de reenviar.')
      window.dispatchEvent(new Event('client-invitations:changed'))
    } finally { setBusy(false) }
  }
  return <>
    <Button variant="outline" className="min-h-11 w-full" disabled={disabled || !email} onClick={() => { setOpen(true); setSuccess(false); setMessage(''); setActivationLink('') }}><Mail className="size-4" /> Convidar para o portal</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value) }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Convidar {nome}</DialogTitle><DialogDescription>Confira se este e-mail pertence ao responsável pelo cadastro. O convite permite acessar os pets e o histórico desse cliente.</DialogDescription></DialogHeader>
        <p className="rounded-xl bg-muted p-3 text-sm break-all">{email}</p>
        <div className="space-y-2 text-sm"><p>O e-mail terá um link individual para confirmar o endereço e definir a própria senha.</p><p className="text-muted-foreground">Validade: 48 horas. Uso único. Reenviar invalida o convite anterior. Contas existentes não são alteradas.</p></div>
        {message && <p role={success ? 'status' : 'alert'} className={success ? 'text-sm text-green-700' : 'text-sm text-destructive'}>{message}</p>}
        {activationLink && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">Link individual de ativação</p>
          <Input readOnly value={activationLink} onFocus={(event) => event.target.select()} className="bg-white text-xs" />
          <Button type="button" variant="outline" className="w-full" onClick={async () => {
            try {
              await navigator.clipboard.writeText(activationLink)
              setMessage('Link de ativação copiado. Envie apenas ao responsável por este cadastro.')
            } catch {
              setMessage('Selecione e copie o link manualmente.')
            }
          }}>Copiar link de ativação</Button>
        </div>}
        <Button className="min-h-11" disabled={busy || success} onClick={() => void send()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}{success ? 'Convite encaminhado' : 'Confirmar e enviar convite'}</Button>
      </DialogContent>
    </Dialog>
  </>
}
