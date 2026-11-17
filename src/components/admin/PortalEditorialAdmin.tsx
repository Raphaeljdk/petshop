'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Camera, Gift, PawPrint, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { portalRequest } from '@/components/cliente-portal/ExperienceProvider'

type Article = {
  id:string;title:string;category:string;summary:string;body:string
  imageUrl:string|null;productId:string|null;published:boolean
}
type PlanRequest = {
  id:string;clienteId:string;petKey:string;status:string;sessionsUsed:number
  plan:{ title:string;sessions:number }
}
type Gift = {id:string;clienteId:string;recipientName:string;recipientPhone:string|null;amountCents:number;status:string}
type Referral = {id:string;invitedId:string;status:string}
type PortalAdmin = {
  articles:Article[];plans:Array<{id:string;title:string;priceCents:number;active:boolean}>
  requests:PlanRequest[];gifts:Gift[];referrals:Referral[]
  referralConfig:{active:boolean;awardCents:number;minimumPurchaseCents:number;validDays:number}|null
  integrations?:{
    subscriptions:{enabled:boolean;configured:boolean;validatedEndToEnd:boolean}
    giftRedemption:{enabled:boolean}
    email:{configured:boolean;domainVerification:string}
    whatsapp:{configured:boolean;templateVerification:string}
    notifications:{enabled:boolean;cronConfigured:boolean}
  }
}
const categories=['Cuidados','Comportamento','Brinquedos','Bem-estar','Novidades']
const emptyArticle = {
  title:'',category:'Cuidados',summary:'',body:'',imageUrl:'',productId:'',published:false,
}
const money=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

export function PortalEditorialAdmin() {
  const [data,setData]=useState<PortalAdmin|null>(null)
  const [error,setError]=useState('')
  const [refresh,setRefresh]=useState(0)
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({...emptyArticle})
  const [editId,setEditId]=useState<string|null>(null)
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [sessions,setSessions]=useState('4')
  const [duration,setDuration]=useState('30')
  const [price,setPrice]=useState('100')
  const [reference,setReference]=useState('')
  const [processId,setProcessId]=useState('')
  const [sessionProcessId,setSessionProcessId]=useState('')
  const [photoKind,setPhotoKind]=useState<'banho_antes'|'banho_depois'>('banho_antes')
  const [photoTitle,setPhotoTitle]=useState('Foto do atendimento')
  const [image,setImage]=useState<string|null>(null)
  const [bonusEnabled,setBonusEnabled]=useState(false)
  const [bonusValue,setBonusValue]=useState('0')
  const [bonusMinimum,setBonusMinimum]=useState('0')
  const [bonusDays,setBonusDays]=useState('30')

  useEffect(()=>{
    let live=true
    portalRequest<PortalAdmin>('/api/admin/portal').then((v)=>{if(live){setData(v);setError('')
      if(v.referralConfig){setBonusEnabled(v.referralConfig.active);
        setBonusValue(String(v.referralConfig.awardCents/100));
        setBonusMinimum(String(v.referralConfig.minimumPurchaseCents/100));
        setBonusDays(String(v.referralConfig.validDays))}
    }})
      .catch((e)=>{if(live)setError((e as Error).message)})
    return ()=>{live=false}
  },[refresh])

  async function submit(payload:Record<string,unknown>) {
    if(busy)return
    setBusy(true)
    try {
      const response=await portalRequest<{note?:string}>('/api/admin/portal',{method:'POST',body:JSON.stringify(payload)})
      toast.success(response.note || 'Informação registrada.')
      setRefresh(x=>x+1)
      return true
    } catch(e){toast.error((e as Error).message);return false}
    finally{setBusy(false)}
  }
  return <Card className="mt-5">
    <CardContent className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="size-5 text-primary"/>Conteúdos e novos serviços do portal</h2>
          <p className="text-xs text-muted-foreground">Gestão interna; artigos publicados aparecem somente no perfil dos clientes.</p></div>
        <Button variant="outline" size="sm" onClick={()=>setRefresh(x=>x+1)}><RefreshCw className="mr-1 size-4"/>Atualizar</Button>
      </div>
      {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Integrações — prontidão para ativação</summary>
        <div className="mt-3 space-y-2 text-xs">
          <p><strong>Assinaturas Mercado Pago:</strong> {data?.integrations?.subscriptions.enabled?'Liberação técnica habilitada':'Bloqueadas até homologação'}.
            {data?.integrations?.subscriptions.configured?' Credenciais básicas identificadas.':' Configuração de pagamento incompleta.'}
            Ainda é necessário testar cobrança e renovação reais.</p>
          <p><strong>Vales no checkout:</strong> {data?.integrations?.giftRedemption.enabled?'Liberação técnica habilitada':'Resgate bloqueado até homologação fiscal e financeira'}.</p>
          <p><strong>E-mail:</strong> {data?.integrations?.email.configured?'Configuração de envio identificada':'Chave e/ou remetente ainda não configurados'}.
            É necessário validar DKIM/SPF e confirmar o domínio no Resend antes de ativar.</p>
          <p><strong>WhatsApp:</strong> {data?.integrations?.whatsapp.configured?'Credenciais e nome de template informados':'Configuração da Meta Cloud API incompleta'}.
            A aprovação e a entrega de uma mensagem de teste ainda precisam ser verificadas.</p>
          <p><strong>Notificações automáticas:</strong> {data?.integrations?.notifications.enabled?'Flag de envio habilitada':'Desabilitadas por segurança'}
            {data?.integrations?.notifications.cronConfigured?' · Cron autenticado configurado.':' · Cron não configurado.'}</p>
          <p className="text-muted-foreground">Este diagnóstico indica somente presença das configurações. Não valida saldos, pagamentos, domínio ou entregas reais.</p>
        </div>
      </details>
      <details open className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Blog — criar e revisar artigos</summary>
        <div className="mt-4 space-y-3">
          <form onSubmit={async(e)=>{
            e.preventDefault()
            const ok=await submit({ action:editId?'article-update':'article-create',
              ...(editId?{id:editId}:{}),...form,productId:form.productId||null })
            if(ok){setForm({...emptyArticle});setEditId(null)}
          }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">Título<Input required minLength={6} maxLength={150} value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))}/></label>
              <label className="space-y-1 text-xs">Categoria
                <select className="block h-10 w-full rounded-md border bg-background px-2" value={form.category}
                  onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}>
                  {categories.map((cat)=><option key={cat}>{cat}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">Resumo (15–320 caracteres)
                <Textarea minLength={15} maxLength={320} value={form.summary} onChange={(e)=>setForm(f=>({...f,summary:e.target.value}))}/>
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">Corpo do artigo (60–16.000 caracteres; parágrafos separados por linha vazia)
                <Textarea required minLength={60} maxLength={16000} rows={8} value={form.body} onChange={(e)=>setForm(f=>({...f,body:e.target.value}))}/>
              </label>
              <label className="space-y-1 text-xs">URL HTTPS da imagem de capa (opcional)<Input type="url" value={form.imageUrl} onChange={(e)=>setForm(f=>({...f,imageUrl:e.target.value}))}/></label>
              <label className="space-y-1 text-xs">ID do produto relacionado (opcional)<Input value={form.productId} onChange={(e)=>setForm(f=>({...f,productId:e.target.value}))}/></label>
            </div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e)=>setForm(f=>({...f,published:e.target.checked}))}/>
              Publicar para os clientes após revisão editorial</label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{editId?'Salvar artigo':'Criar artigo'}</Button>
              {editId&&<Button type="button" variant="outline" onClick={()=>{setEditId(null);setForm({...emptyArticle})}}>Cancelar edição</Button>}
            </div>
          </form>
          <div className="space-y-2">
            {data?.articles.map((a)=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div><strong>{a.title}</strong><p className="text-xs text-muted-foreground">{a.category} · {a.published?'Publicado':'Rascunho'}</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>{setEditId(a.id);setForm({
                  title:a.title,category:a.category,summary:a.summary,body:a.body,
                  imageUrl:a.imageUrl||'',productId:a.productId||'',published:a.published,
                })}}>Editar</Button>
                {a.published&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submit({action:'article-unpublish',id:a.id})}>Despublicar</Button>}
              </div>
            </div>)}
            {data?.articles.length===0&&<p className="text-xs text-muted-foreground">Ainda não há artigos cadastrados.</p>}
          </div>
        </div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Planos de banho — cadastrar e validar solicitações</summary>
        <div className="mt-3 space-y-3">
          <form onSubmit={async(e)=>{
            e.preventDefault()
            const ok=await submit({action:'plan-create',title,description,sessions:Number(sessions),
              durationDays:Number(duration),priceCents:Math.round(Number(price)*100),active:true})
            if(ok){setTitle('');setDescription('')}
          }} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">Plano<Input required minLength={4} value={title} onChange={(e)=>setTitle(e.target.value)}/></label>
            <label className="space-y-1 text-xs">Valor (R$)<Input type="number" required min="1" max="10000" step="0.01" value={price} onChange={(e)=>setPrice(e.target.value)}/></label>
            <label className="space-y-1 text-xs">Sessões<Input type="number" required min="1" max="30" value={sessions} onChange={(e)=>setSessions(e.target.value)}/></label>
            <label className="space-y-1 text-xs">Validade (dias)<Input type="number" required min="7" max="365" value={duration} onChange={(e)=>setDuration(e.target.value)}/></label>
            <label className="space-y-1 text-xs sm:col-span-2">Descrição<Input required minLength={10} value={description} onChange={(e)=>setDescription(e.target.value)}/></label>
            <Button type="submit" disabled={busy}>Cadastrar plano</Button>
          </form>
          <p className="text-xs text-muted-foreground">{data?.plans.map((p)=>p.title+' '+money(p.priceCents)).join(' · ')||'Nenhum plano cadastrado.'}</p>
          <label className="block space-y-1 text-xs">Referência do pagamento conferido (para aprovação manual)
            <Input value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="Identificador do comprovante / transação"/>
          </label>
          <label className="block space-y-1 text-xs">ID do atendimento concluído para baixar sessão de um plano ativo
            <Input value={sessionProcessId} onChange={(e)=>setSessionProcessId(e.target.value)} placeholder="ID do atendimento finalizado"/>
          </label>
          {data?.requests.map((r)=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
            <div><strong>{r.plan.title}</strong><p>Cliente: {r.clienteId} · Pet: {r.petKey} · {r.status==='ativo'?r.sessionsUsed+'/'+r.plan.sessions+' sessões':'Solicitado'}</p></div>
            <div className="flex gap-2">
              {r.status==='solicitado'?<>
                <Button size="sm" disabled={busy||reference.trim().length<4}
                  onClick={()=>void submit({action:'plan-review',id:r.id,status:'ativo',paymentVerified:true,paymentReference:reference})}>Confirmar pago e ativar</Button>
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={()=>void submit({action:'plan-review',id:r.id,status:'recusado',paymentVerified:false})}>Recusar</Button>
              </>:<Button size="sm" disabled={busy||!sessionProcessId.trim()||r.sessionsUsed>=r.plan.sessions}
                onClick={()=>void submit({action:'plan-use',requestId:r.id,processoId:sessionProcessId})}>Baixar sessão concluída</Button>}
            </div>
          </div>)}
          <p className="text-xs text-muted-foreground">A cobrança recorrente utiliza o Mercado Pago e a baixa manual de sessões está vinculada aos atendimentos concluídos. Só ative após validação de pagamentos reais e webhook assinado.</p>
        </div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Indique e Ganhe — editar bônus {data?.referralConfig ? '('+money(data.referralConfig.awardCents)+')' : '(não configurado)'}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Edite aqui o valor do bônus de indicação, a compra mínima e a validade. O benefício só será emitido após uma primeira compra elegível realmente paga. Nenhum valor padrão foi ativado.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bonusEnabled} onChange={(e)=>setBonusEnabled(e.target.checked)}/>Ativar benefícios de indicação</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs">Valor do bônus (R$)
              <Input type="number" min="0" max="100" step="0.01" value={bonusValue} onChange={(e)=>setBonusValue(e.target.value)}/>
            </label>
            <label className="space-y-1 text-xs">Compra mínima (R$)
              <Input type="number" min="0" max="1000" step="0.01" value={bonusMinimum} onChange={(e)=>setBonusMinimum(e.target.value)}/>
            </label>
            <label className="space-y-1 text-xs">Validade do cupom (dias)
              <Input type="number" min="1" max="365" value={bonusDays} onChange={(e)=>setBonusDays(e.target.value)}/>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Prévia: {money(Math.round(Number(bonusValue||0)*100))} em desconto individual,
            para compras a partir de {money(Math.round(Number(bonusMinimum||0)*100))}, com {bonusDays} dia(s) de validade.
          </p>
          <Button size="sm" disabled={busy||!Number.isFinite(Number(bonusValue))||
            !Number.isFinite(Number(bonusMinimum))||!Number.isInteger(Number(bonusDays))||
            Number(bonusValue)<0||Number(bonusValue)>100||Number(bonusMinimum)<0||
            Number(bonusMinimum)>1000||Number(bonusDays)<1||Number(bonusDays)>365||
            (bonusEnabled&&Number(bonusValue)<=0)} onClick={()=>void submit({
            action:'referral-config',active:bonusEnabled,awardCents:Math.round(Number(bonusValue)*100),
            minimumPurchaseCents:Math.round(Number(bonusMinimum)*100),validDays:Number(bonusDays),
          })}>Salvar valor e regras de indicação</Button>
        </div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Vales-presente e indicações</summary>
        <div className="mt-3 space-y-3">
          <label className="block space-y-1 text-xs">Referência do pagamento conferido<Input value={reference} onChange={(e)=>setReference(e.target.value)}/></label>
          {data?.gifts.map((g)=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
            <div><strong>{g.recipientName}</strong><p>{money(g.amountCents)} · {g.status} · Cliente {g.clienteId}</p><p>{g.recipientPhone ? 'Telefone: +' + g.recipientPhone : 'Vale anterior à exigência de telefone'}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy||reference.trim().length<4}
                onClick={()=>void submit({action:'gift-review',id:g.id,status:'pago',paymentVerified:true,paymentReference:reference})}>Confirmar pagamento</Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={()=>void submit({action:'gift-review',id:g.id,status:'aguardando_pagamento',paymentVerified:false})}>Aguardar</Button>
            </div>
          </div>)}
          {data?.referrals.map((r)=><div key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-xs">
            <p>Indicação de cliente {r.invitedId} · {r.status}</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={()=>void submit({action:'referral-review',id:r.id})}>Verificar compra paga</Button>
          </div>)}
          <p className="text-xs text-muted-foreground">Vale-presente tem resgate programado no checkout, mas ainda exige homologação de pagamento, saldo, cancelamento e conciliação fiscal antes de liberar para clientes.</p>
        </div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">Fotos de antes/depois de um banho</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Somente fotos de atendimentos existentes com consentimento ativo do tutor. A imagem fica privada no portal do cliente.</p>
          <label className="block space-y-1 text-xs">ID do atendimento<Input value={processId} onChange={(e)=>setProcessId(e.target.value)}/></label>
          <label className="block space-y-1 text-xs">Título<Input value={photoTitle} onChange={(e)=>setPhotoTitle(e.target.value)}/></label>
          <label className="block space-y-1 text-xs">Etapa
            <select className="block h-10 w-full rounded-md border bg-background px-3"
              value={photoKind} onChange={(e)=>setPhotoKind(e.target.value as 'banho_antes'|'banho_depois')}>
              <option value="banho_antes">Antes do banho</option><option value="banho_depois">Depois do banho</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs">Imagem comprimida JPEG/PNG/WebP
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{
              const f=e.target.files?.[0];if(!f)return
              if(f.size>180000){toast.error('Envie uma foto de até 130 KB nesta etapa.');return}
              const reader=new FileReader();reader.onload=()=>setImage(String(reader.result||''));reader.readAsDataURL(f)
            }}/>
          </label>
          <Button size="sm" disabled={busy||!processId||!image} onClick={()=>void submit({
            action:'grooming-photo',processoId:processId,kind:photoKind,title:photoTitle,imageData:image,
          })}><Camera className="mr-1 size-4"/>Adicionar foto privada</Button>
        </div>
      </details>
    </CardContent>
  </Card>
}
