'use client'

import { useEffect, useState } from 'react'
import { BookHeart, Camera, Gift, HeartHandshake, Syringe, Bell, Sparkles, Users, Repeat, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { portalRequest } from './ExperienceProvider'

type Pet = { id:string; nome:string; especie:string; porte:string|null; fotoUrl:string|null }
type Memory = {
  id:string; petKey:string; kind:string; title:string; notes:string|null
  weightKg:number|null; eventAt:string; nextAt:string|null; imageData:string|null; createdByAdmin:boolean
}
type Prefs = {
  remindersInApp:boolean; remindersEmail:boolean; remindersWhatsapp:boolean
  marketingEmail:boolean; marketingWhatsapp:boolean; groomingPhotoConsent:boolean
}
type Plan = { id:string; title:string; description:string; sessions:number; priceCents:number; durationDays:number }
type PlanRequest = {
  id:string; petKey:string; status:string; sessionsUsed:number; startsAt:string|null; expiresAt:string|null
  providerSubscriptionId:string|null;providerCheckoutUrl:string|null;providerStatus:string|null;cancelAtPeriodEnd:boolean
  plan:{ title:string; sessions:number; priceCents:number }
}
type Invite = { id:string; petKey:string; recipientEmail?:string; status:string }
type PortalData = {
  features?: {subscriptionsEnabled:boolean;giftRedemptionEnabled:boolean}
  pets:Pet[]; memories:Memory[]; preferences:Prefs; plans:Plan[]; requests:PlanRequest[]
  recommendations:Array<{ id:string; nome:string; imageUrl:string|null; preco:number; precoPromo:number|null }>
  referralCode:string|null; referrals:Array<{ id:string;status:string }>
  gifts:Array<{ id:string;recipientName:string;amountCents:number;status:string;voucherCode:string|null }>
  rewardCoupons:Array<{ codigo:string;descricao:string|null;valor:number;fimEm:string|null }>
  notifications:Array<{id:string;text:string;sentAt:string|null}>
  documents:Array<{id:string;petKey:string;title:string;fileName:string;sizeBytes:number;createdAt:string}>
  incoming:Invite[]; outgoing:Invite[]
  sharedPets:Array<{ inviteId:string; pet:{ nome:string; especie:string };
    agenda:Array<{ id:string; dataHora:string; servico:string; status:string }> }>
}
const money = (n:number) => (n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const previewMoney = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const date = (d:string) => new Date(d).toLocaleDateString('pt-BR')
const defaultPrefs:Prefs = {
  remindersInApp:true,remindersEmail:false,remindersWhatsapp:false,
  marketingEmail:false,marketingWhatsapp:false,groomingPhotoConsent:false,
}

/** Reduz a imagem no aparelho; fotos são enviadas somente pela API autenticada. */
async function photoFileToData(file:File):Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Envie uma imagem JPEG, PNG ou WebP.')
  if (file.size > 8_000_000) throw Error('A imagem original deve ter até 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve(); img.onerror=()=>reject(Error('Não foi possível ler a imagem.')); img.src=url
    })
    const ratio = Math.min(1,720 / Math.max(img.width,img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1,Math.round(img.width*ratio))
    canvas.height = Math.max(1,Math.round(img.height*ratio))
    canvas.getContext('2d')?.drawImage(img,0,0,canvas.width,canvas.height)
    const data=canvas.toDataURL('image/jpeg',0.67)
    if (data.length > 210000) throw Error('Foto muito grande. Tente outra imagem.')
    return data
  } finally { URL.revokeObjectURL(url) }
}

function Section({ title, hint, children, open=false }: {
  title:string; hint:string; children:React.ReactNode; open?:boolean
}) {
  return <details open={open || undefined} className="group overflow-hidden rounded-xl border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold">
      <span>{title}</span><span className="text-xs text-muted-foreground">Abrir / fechar</span>
    </summary>
    <div className="space-y-4 border-t p-4"><p className="text-xs text-muted-foreground">{hint}</p>{children}</div>
  </details>
}

export function ClientCareHub({ onShop }: { onShop:()=>void }) {
  const [data,setData] = useState<PortalData|null>(null)
  const [loading,setLoading] = useState(true)
  const [err,setErr] = useState('')
  const [retry,setRetry] = useState(0)
  const [busy,setBusy] = useState(false)
  const [petKey,setPetKey] = useState('')
  const [kind,setKind] = useState<'diario'|'vacina_documento'>('diario')
  const [title,setTitle] = useState('')
  const [notes,setNotes] = useState('')
  const [weight,setWeight] = useState('')
  const [imageData,setImageData] = useState<string|null>(null)
  const [nextDate,setNextDate] = useState('')
  const [prefs,setPrefs] = useState<Prefs>(defaultPrefs)
  const [refCode,setRefCode] = useState('')
  const [giftName,setGiftName] = useState('')
  const [giftEmail,setGiftEmail] = useState('')
  const [giftValue,setGiftValue] = useState('50')
  const [giftNote,setGiftNote] = useState('')
  const [familyEmail,setFamilyEmail] = useState('')
  const [pdfTitle,setPdfTitle]=useState('')
  const [pdfFile,setPdfFile]=useState<File|null>(null)

  useEffect(()=>{
    let alive=true
    portalRequest<PortalData>('/api/cliente/portal').then((value)=>{
      if(!alive) return
      setData(value);setPrefs(value.preferences||defaultPrefs)
      setPetKey((current)=>current || value.pets?.[0]?.id || '')
      setErr('')
    }).catch((e)=>{if(alive)setErr((e as Error).message)})
      .finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[retry])

  async function act(payload:Record<string,unknown>,success='Informação salva.') {
    if(busy) return
    setBusy(true)
    try {
      const response=await portalRequest<{ code?:string;note?:string }>('/api/cliente/portal',{
        method:'POST',body:JSON.stringify(payload),
      })
      toast.success(response.note || success)
      setRetry(n=>n+1)
      return response
    } catch (e) {toast.error((e as Error).message)}
    finally {setBusy(false)}
  }

  async function manageSubscription(requestId:string,action:'start'|'cancel') {
    if(busy)return
    setBusy(true)
    try{
      const res=await portalRequest<{url?:string;success?:boolean}>('/api/cliente/portal/assinaturas',{
        method:'POST',body:JSON.stringify({action,requestId}),
      })
      if(action==='start'&&res.url){window.location.assign(res.url);return}
      toast.success('Assinatura cancelada no provedor. Período já pago permanece disponível.')
      setRetry(n=>n+1)
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível atualizar a assinatura.')}
    finally{setBusy(false)}
  }
  async function uploadPDF() {
    if(!petKey||!pdfFile||!pdfTitle.trim()||busy)return
    if(pdfFile.size>1_048_576||pdfFile.type!=='application/pdf') {
      toast.error('Envie um PDF de até 1 MB.');return
    }
    setBusy(true)
    try{
      const fileData=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'')
        reader.onerror=()=>reject(new Error('Não foi possível ler o PDF.'))
        reader.readAsDataURL(pdfFile)
      })
      await portalRequest('/api/cliente/portal/documentos',{method:'POST',
        body:JSON.stringify({petKey,title:pdfTitle,fileName:pdfFile.name,fileData}),
      })
      toast.success('PDF guardado no seu perfil privado.')
      setPdfTitle('');setPdfFile(null);setRetry(n=>n+1)
    }catch(e){toast.error(e instanceof Error?e.message:'Falha no upload do PDF.')}
    finally{setBusy(false)}
  }
  const mem=data?.memories.filter((m)=>m.petKey===petKey)||[]
  const petName=data?.pets.find((p)=>p.id===petKey)?.nome || 'seu pet'
  if(loading) return <div className="h-40 animate-pulse rounded-xl bg-muted" role="status" aria-label="Carregando cuidados"/>
  if(err) return <Card><CardContent className="space-y-2 p-4">
    <p className="text-sm">{err}</p><Button size="sm" onClick={()=>{setLoading(true);setRetry(n=>n+1)}}>Tentar novamente</Button>
  </CardContent></Card>
  if(!data) return null
  return <section className="mt-8 space-y-4" aria-label="Vida do pet e benefícios">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Área exclusiva</p>
      <h2 className="text-xl font-bold">Vida do pet e benefícios</h2>
      <p className="text-xs text-muted-foreground">Seu diário, documentos, planos e preferências em um só lugar.</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-medium" htmlFor="care-pet">Pet selecionado</label>
      <select id="care-pet" value={petKey} onChange={(e)=>setPetKey(e.target.value)}
        className="min-h-10 max-w-full rounded-md border bg-background px-3 text-sm">
        {!data.pets.length && <option value="">Nenhum pet vinculado</option>}
        {data.pets.map((p)=><option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>

    <Section title="Diário do Pet e carteirinha de cuidados" hint="Registros adicionados por você ficam privados na sua conta. Fotos são armazenadas no banco do portal, não no ERP oficial." open>
      {!petKey ? <p className="text-sm">Cadastre ou vincule um pet antes de adicionar registros.</p> : <>
        <div className="flex gap-2">
          <Button size="sm" variant={kind==='diario'?'default':'outline'} onClick={()=>setKind('diario')}><BookHeart className="mr-1 size-4"/>Diário</Button>
          <Button size="sm" variant={kind==='vacina_documento'?'default':'outline'} onClick={()=>setKind('vacina_documento')}><Syringe className="mr-1 size-4"/>Documento de vacina</Button>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={async(e)=>{
          e.preventDefault()
          if(!title.trim()) return
          const response=await act({action:'memory',petKey,kind,title,notes,imageData,
            weightKg:kind==='diario'&&weight?Number(weight):null,
            nextAt:kind==='vacina_documento'&&nextDate?new Date(nextDate).toISOString():null},'Registro adicionado.')
          if(response){setTitle('');setNotes('');setWeight('');setImageData(null);setNextDate('')}
        }}>
          <label className="space-y-1 text-xs">Título do registro
            <Input required minLength={2} maxLength={120} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder={kind==='diario'?'Ex.: Primeiro banho':'Ex.: Vacina registrada pelo tutor'}/>
          </label>
          <label className="space-y-1 text-xs">Foto JPEG/PNG/WebP (opcional)
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{
              const file=e.target.files?.[0]
              if(file) void photoFileToData(file).then(setImageData).catch(err=>toast.error(err.message))
            }}/>
          </label>
          {kind==='diario' && <label className="space-y-1 text-xs">Peso registrado em kg (opcional)
            <Input type="number" min="0.1" max="200" step="0.01" value={weight} onChange={(e)=>setWeight(e.target.value)}/>
          </label>}
          {kind==='vacina_documento' && <label className="space-y-1 text-xs">Próxima data anotada (opcional)
            <Input type="date" value={nextDate} onChange={(e)=>setNextDate(e.target.value)}/>
          </label>}
          <label className="space-y-1 text-xs sm:col-span-2">Anotações
            <Textarea rows={2} maxLength={2000} value={notes} onChange={(e)=>setNotes(e.target.value)}/>
          </label>
          {imageData && <p className="text-xs text-green-700">Imagem pronta para salvar com segurança.</p>}
          <Button type="submit" disabled={busy||!petKey}>Adicionar ao {kind==='diario'?'diário':'histórico particular'}</Button>
        </form>
        <div className="space-y-2">
          {mem.filter((m)=>m.kind==='diario'||m.kind==='vacina_documento').length===0 && <p className="text-xs text-muted-foreground">Nenhum registro particular para {petName}.</p>}
          {mem.filter((m)=>m.kind==='diario'||m.kind==='vacina_documento').map((m)=>
            <article className="flex gap-3 rounded-lg border p-3" key={m.id}>
              {m.imageData&&<img src={m.imageData} alt={'Registro de '+petName} className="size-20 rounded-md object-cover"/>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground">{date(m.eventAt)} · {m.kind==='vacina_documento'?'Comprovante do tutor':'Diário'}</p>
                {m.notes&&<p className="mt-1 whitespace-pre-wrap break-words text-xs">{m.notes}</p>}
                {m.weightKg!=null&&<p className="text-xs">Peso: {m.weightKg.toLocaleString('pt-BR')} kg</p>}
                {m.nextAt&&<p className="text-xs">Próxima data anotada: {date(m.nextAt)}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">Registro particular; não substitui prontuário nem orientação veterinária.</p>
              </div>
              {!m.createdByAdmin&&<Button variant="ghost" size="icon" disabled={busy} aria-label="Remover registro"
                onClick={()=>{if(window.confirm('Excluir este registro definitivamente?'))void act({action:'remove-memory',id:m.id},'Registro removido.')}}><Trash2 className="size-4"/></Button>}
            </article>)}
        </div>
      </>}
    </Section>

    <Section title="Documentos PDF do pet" hint="Arquivos restritos ao tutor autenticado. Não são públicos nem ficam acessíveis aos familiares convidados.">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">Título do documento
          <Input maxLength={120} value={pdfTitle} onChange={(e)=>setPdfTitle(e.target.value)} placeholder="Ex.: Comprovante de vacinação"/>
        </label>
        <label className="space-y-1 text-xs">Arquivo PDF, até 1 MB
          <Input type="file" accept="application/pdf,.pdf" onChange={(e)=>setPdfFile(e.target.files?.[0]||null)}/>
        </label>
      </div>
      <Button size="sm" disabled={!pdfFile||!pdfTitle.trim()||busy||!petKey} onClick={()=>void uploadPDF()}>Guardar documento privado</Button>
      {data.documents?.filter((d)=>d.petKey===petKey).map((d)=><div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
        <div><strong>{d.title}</strong><p className="text-muted-foreground">{d.fileName} · {Math.round(d.sizeBytes/1024)} KB</p></div>
        <div className="flex gap-2">
          <a className="inline-flex min-h-9 items-center rounded-md border px-3 py-2 font-medium" href={'/api/cliente/portal/documentos/'+encodeURIComponent(d.id)}>Baixar PDF</a>
          <Button variant="outline" size="sm" disabled={busy} onClick={async()=>{
            if(!window.confirm('Excluir definitivamente este PDF?'))return
            setBusy(true)
            try{await portalRequest('/api/cliente/portal/documentos/'+encodeURIComponent(d.id),{method:'DELETE'});toast.success('Documento excluído.');setRetry(n=>n+1)}
            catch(e){toast.error((e as Error).message)}finally{setBusy(false)}
          }}>Excluir</Button>
        </div>
      </div>)}
    </Section>

    <Section title="Fotos e etapas do banho" hint="Fotos da equipe só ficam disponíveis com seu consentimento expresso; sem publicação pública.">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={prefs.groomingPhotoConsent}
        onChange={(e)=>setPrefs(p=>({...p,groomingPhotoConsent:e.target.checked}))}/>
        Autorizo registrar e exibir fotos de antes e depois dos atendimentos do meu pet neste portal privado.</label>
      <Button size="sm" disabled={busy} onClick={()=>void act({action:'preferences',...prefs},'Permissão atualizada.')}>Salvar autorização</Button>
      <div className="grid gap-3 sm:grid-cols-2">
        {mem.filter((m)=>['banho_antes','banho_depois'].includes(m.kind)).map((m)=>
          <div key={m.id} className="rounded-xl border p-3">
            {m.imageData&&<img src={m.imageData} alt={m.title} className="h-36 w-full rounded-lg object-cover"/>}
            <p className="mt-2 text-sm font-medium">{m.kind==='banho_antes'?'Antes do banho':'Depois do banho'} · {m.title}</p>
            <p className="text-xs text-muted-foreground">{date(m.eventAt)}</p>
          </div>)}
      </div>
      {!mem.some((m)=>m.kind.startsWith('banho_'))&&<p className="text-xs text-muted-foreground">A equipe ainda não adicionou fotos deste pet.</p>}
    </Section>

    <Section title="Preferências de notificações" hint="Escolha como deseja receber comunicados. Ativar um canal não garante envio até que a integração seja homologada.">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['remindersInApp','Lembretes dentro do portal'],
          ['remindersEmail','Lembretes por e-mail'],
          ['remindersWhatsapp','Lembretes por WhatsApp'],
          ['marketingEmail','Ofertas por e-mail'],
          ['marketingWhatsapp','Ofertas por WhatsApp'],
        ] as Array<[keyof Prefs,string]>).map(([key,label])=>
          <label key={key} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" checked={prefs[key]} onChange={(e)=>setPrefs(p=>({...p,[key]:e.target.checked}))}/>
            {label}
          </label>)}
      </div>
      <Button size="sm" disabled={busy} onClick={()=>void act({action:'preferences',...prefs})}><Bell className="mr-1 size-4"/>Salvar preferências</Button>
    </Section>

    <Section title="Avisos dentro do portal" hint="Histórico de lembretes que a Matilha Prado registrou na sua conta.">
      {data.notifications?.length ? data.notifications.map((n)=><div key={n.id} className="rounded-lg border p-3 text-xs">
        <p>{n.text}</p>{n.sentAt&&<p className="mt-1 text-muted-foreground">{new Date(n.sentAt).toLocaleString('pt-BR')}</p>}
      </div>):<p className="text-xs text-muted-foreground">Nenhum aviso registrado no momento.</p>}
    </Section>

    <Section title="Planos de banho e cuidados" hint="Pacotes disponíveis, mediante aprovação da loja; solicitar não efetua pagamento nem ativa sessões automaticamente.">
      <div className="grid gap-3 sm:grid-cols-2">
        {data.plans.map((plan)=><div className="space-y-2 rounded-xl border p-3" key={plan.id}>
          <h3 className="font-semibold">{plan.title}</h3><p className="text-xs text-muted-foreground">{plan.description}</p>
          <p className="text-sm">{plan.sessions} sessões · {plan.durationDays} dias · <strong>{money(plan.priceCents)}</strong></p>
          <Button size="sm" disabled={!petKey||busy} onClick={()=>void act({action:'plan-request',planId:plan.id,petKey},'Solicitação enviada.')}>Solicitar para {petName}</Button>
        </div>)}
      </div>
      {!data.plans.length&&<p className="text-sm text-muted-foreground">A Matilha Prado ainda não publicou planos.</p>}
      {data.requests.filter((r)=>r.petKey===petKey).map((r)=><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" key={r.id}>
        <p className="text-xs">{r.plan.title}: {r.status} · sessões utilizadas: {r.sessionsUsed}/{r.plan.sessions}
          {r.expiresAt&&' · validade até '+date(r.expiresAt)}
          {r.cancelAtPeriodEnd&&' · renovação cancelada'}
        </p>
        {data.features?.subscriptionsEnabled && ['solicitado','checkout_pendente'].includes(r.status) && <Button size="sm" disabled={busy}
          onClick={()=>void manageSubscription(r.id,'start')}>Assinar mensalmente pelo Mercado Pago</Button>}
        {r.providerSubscriptionId && !r.cancelAtPeriodEnd && <Button size="sm" variant="outline" disabled={busy}
          onClick={()=>{if(window.confirm('Cancelar as próximas cobranças recorrentes deste plano?'))void manageSubscription(r.id,'cancel')}}>Cancelar renovação</Button>}
      </div>)}
      <p className="text-xs text-muted-foreground">
        {data.features?.subscriptionsEnabled
          ? 'O plano só fica ativo após confirmação de pagamento no Mercado Pago. Renovações são gerenciadas pelo provedor.'
          : 'Assinaturas online aguardam homologação financeira. Você pode consultar os planos; a contratação automática ainda não está disponível.'}
      </p>
    </Section>

    <Section title="Recomendações para seu pet" hint="Sugestões simples por espécie, porte e catálogo disponível. Revise produto, preço e estoque na loja antes de comprar.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.recommendations.map((p)=><button key={p.id} type="button" onClick={onShop}
          className="flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted/40">
          {p.imageUrl&&<img src={p.imageUrl} alt="" className="size-14 rounded-lg object-cover"/>}
          <span className="min-w-0"><strong className="line-clamp-2 text-xs">{p.nome}</strong>
            <span className="block text-xs text-muted-foreground">{previewMoney(p.precoPromo??p.preco)}</span></span>
        </button>)}
      </div>
      {!data.recommendations.length&&<p className="text-xs text-muted-foreground">Sem sugestões compatíveis no catálogo atual.</p>}
      <Button size="sm" variant="outline" onClick={onShop}><Sparkles className="mr-1 size-4"/>Explorar produtos</Button>
    </Section>

    <Section title="Indique e Ganhe" hint="Indicações são registradas; vantagens e descontos só serão definidos e liberados pela Matilha Prado após compra elegível.">
      <div className="flex flex-wrap gap-2">
        {data.referralCode ? <>
          <code className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-semibold">{data.referralCode}</code>
          <Button size="sm" variant="outline" onClick={()=>
            void navigator.clipboard?.writeText(data.referralCode||'').then(()=>toast.success('Código copiado.')).catch(()=>toast.error('Não foi possível copiar.'))
          }>Copiar código</Button>
        </> : <Button size="sm" disabled={busy} onClick={()=>void act({action:'referral-code'},'Código criado.')}>Gerar meu código</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-60" placeholder="Recebeu um código?" value={refCode} onChange={(e)=>setRefCode(e.target.value)}/>
        <Button size="sm" variant="outline" disabled={busy||!refCode.trim()} onClick={()=>void act({action:'referral-claim',code:refCode})}><HeartHandshake className="mr-1 size-4"/>Registrar indicação</Button>
      </div>
      <p className="text-xs text-muted-foreground">{data.referrals.length} indicação(ões) registrada(s) com seu código.</p>
      {data.rewardCoupons?.map((coupon)=><div key={coupon.codigo} className="rounded-lg border p-3 text-xs">
        <strong>Bônus disponível: {coupon.codigo}</strong>
        <p>Desconto de {previewMoney(coupon.valor)} · até {coupon.fimEm?date(coupon.fimEm):'validade informada no checkout'}</p>
        <Button size="sm" variant="outline" onClick={()=>void navigator.clipboard?.writeText(coupon.codigo).then(()=>toast.success('Cupom copiado.'))}>Copiar cupom pessoal</Button>
      </div>)}
    </Section>

    <Section title="Vale-presente digital" hint="Solicite um vale-presente. O código somente será gerado após a loja conferir o pagamento; resgate direto no checkout depende de integração adicional.">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async(e)=>{
        e.preventDefault()
        const response=await act({action:'gift-request',recipientName:giftName,recipientEmail:giftEmail,
          message:giftNote,amountCents:Math.round(Number(giftValue)*100)},'Solicitação registrada.')
        if(response){setGiftName('');setGiftEmail('');setGiftNote('')}
      }}>
        <label className="space-y-1 text-xs">Nome do presenteado<Input required value={giftName} onChange={(e)=>setGiftName(e.target.value)}/></label>
        <label className="space-y-1 text-xs">E-mail (opcional)<Input type="email" value={giftEmail} onChange={(e)=>setGiftEmail(e.target.value)}/></label>
        <label className="space-y-1 text-xs">Valor (R$ 20 a R$ 500)<Input type="number" min="20" max="500" step="0.01" value={giftValue} onChange={(e)=>setGiftValue(e.target.value)}/></label>
        <label className="space-y-1 text-xs">Mensagem (opcional)<Input maxLength={500} value={giftNote} onChange={(e)=>setGiftNote(e.target.value)}/></label>
        <Button type="submit" disabled={busy}><Gift className="mr-1 size-4"/>Solicitar vale-presente</Button>
      </form>
      {data.gifts.map((g)=><div className="rounded-lg bg-muted/50 p-2 text-xs" key={g.id}>
        {g.recipientName} · {money(g.amountCents)} · {g.status}
        {g.voucherCode&&<span className="ml-2 font-semibold">{g.voucherCode} (resgate na loja)</span>}
      </div>)}
    </Section>

    <Section title="Compartilhar cuidados em família" hint="A pessoa convidada aceita no próprio login; depois você precisa aprovar o acesso. Somente nome do pet e próximos agendamentos são compartilhados. Fotos e documentos continuam privados.">
      <div className="flex flex-wrap gap-2">
        <Input type="email" className="max-w-72" placeholder="E-mail do familiar" value={familyEmail} onChange={(e)=>setFamilyEmail(e.target.value)}/>
        <Button size="sm" disabled={busy||!familyEmail||!petKey} onClick={()=>void act({action:'family-invite',petKey,email:familyEmail},'Convite registrado.')}>
          <Users className="mr-1 size-4"/>Convidar
        </Button>
      </div>
      {data.outgoing.filter((i)=>i.petKey===petKey&&i.status!=='revogado').map((i)=><div key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{i.recipientEmail} · {i.status}</span>
        <div className="flex flex-wrap gap-2">
          {i.status==='aguardando_aprovacao'&&<Button size="sm" disabled={busy} onClick={()=>{
            if(window.confirm('Você reconhece esta pessoa e autoriza que ela veja o nome do pet e os próximos agendamentos?'))void act({action:'family-approve',id:i.id},'Acesso autorizado.')
          }}>Autorizar familiar</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={()=>void act({action:'family-revoke',id:i.id},'Acesso revogado.')}>Revogar</Button>
        </div>
      </div>)}
      {data.incoming.filter((i)=>i.status==='pendente').map((i)=><div key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
        <span>Convite pendente de compartilhamento</span>
        <Button size="sm" disabled={busy} onClick={()=>void act({action:'family-response',id:i.id,accepted:true},'Convite aceito.')}>Aceitar</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={()=>void act({action:'family-response',id:i.id,accepted:false},'Convite recusado.')}>Recusar</Button>
      </div>)}
      {data.sharedPets.map((s)=><div key={s.inviteId} className="space-y-1 rounded-lg border p-3 text-xs">
        <p className="font-semibold">{s.pet.nome} · {s.pet.especie}</p>
        {s.agenda.map((a)=><p key={a.id}>{a.servico} · {new Date(a.dataHora).toLocaleString('pt-BR')} · {a.status}</p>)}
      </div>)}
    </Section>
  </section>
}
