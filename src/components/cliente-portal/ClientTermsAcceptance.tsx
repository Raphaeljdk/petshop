'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ClientTermsAcceptance() {
  const [loaded,setLoaded]=useState(false)
  const [acceptedAt,setAcceptedAt]=useState<string|null>(null)
  const [agreed,setAgreed]=useState(false)
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    let alive=true
    fetch('/api/cliente/portal/termos',{cache:'no-store',credentials:'same-origin'})
      .then(async r=>{if(!r.ok)throw Error('Falha ao consultar termo.');return r.json()})
      .then(data=>{if(alive)setAcceptedAt(data.acceptedAt||null)})
      .catch(()=>{if(alive)toast.error('Não foi possível consultar seu aceite dos termos.')})
      .finally(()=>{if(alive)setLoaded(true)})
    return ()=>{alive=false}
  },[])
  if(!loaded||acceptedAt)return null
  async function accept(){
    if(!agreed||saving)return
    setSaving(true)
    try{
      const res=await fetch('/api/cliente/portal/termos',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accepted:true}),
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.error||'Não foi possível registrar o aceite.')
      setAcceptedAt(data.acceptedAt)
      toast.success('Aceite registrado. Você não precisa confirmar novamente nos próximos acessos.')
    }catch(e){toast.error(e instanceof Error?e.message:'Falha ao registrar termo.')}
    finally{setSaving(false)}
  }
  return <section aria-label="Aceite dos termos do portal" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6">
    <div className="rounded-xl border border-primary/25 bg-card p-4 text-sm">
      <p className="font-semibold">Termos de uso do portal Matilha Prado</p>
      <p className="mt-1 text-muted-foreground">Ao usar o portal, você poderá acompanhar os pets vinculados à sua conta, compras e solicitações de serviços. Solicitações de agendamento dependem de confirmação da equipe; planos e vales só são ativados após confirmação de pagamento. Confira também o <Link href="/privacidade" target="_blank" className="font-medium text-primary underline">aviso de privacidade e seus direitos</Link>. A autorização para publicar fotos do pet é opcional, independente destes termos e revogável.</p>
      <p className="mt-1 text-xs text-muted-foreground">O aceite destas condições fica registrado no seu perfil e permanece nos próximos acessos. A Matilha Prado poderá apresentar uma nova versão caso as condições sejam alteradas.</p>
      <label className="mt-3 flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="size-4 accent-primary" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
        Li e concordo com as condições de uso apresentadas e li o aviso de privacidade.
      </label>
      <Button className="mt-3" size="sm" onClick={()=>void accept()} disabled={!agreed||saving}>{saving?'Salvando...':'Registrar meu aceite'}</Button>
    </div>
  </section>
}
