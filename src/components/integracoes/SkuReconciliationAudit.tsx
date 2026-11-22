'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Row={id:string;sku:string|null;nome:string;estoque:number;estoqueHub:number;
  ativo:boolean;mlItemId:string|null;amazonAsin:string|null}
type Group={
  sku:string;items:Row[];status:'physical_count'|'identity_review'|'identical_mirrors'
  divergentStock:boolean;divergentHub:boolean;divergentNames:boolean;divergentPublication:boolean
}
type Audit={
  readOnly:boolean;generatedAt:string;groups:Group[];
  duplicateAsins:Array<{asin:string;ids:string[];skus:Array<string|null>;inconsistentStock:boolean}>
  summary:{products:number;duplicateSkus:number;duplicateRows:number;differentStock:number;
    differentNames:number;hubStockDivergences:number;needsPhysicalCount:number;
    identityReview:number;identicalMirrors:number;duplicateAsins:number;
    conflictingPublication:number}
  pending:{mercadoLivre:number;amazon:number;marketplaceIssues:number}
}
type ChannelResult={configured?:boolean;connected?:boolean;catalogAccess?:boolean;error?:string|null}
const descriptions={
  physical_count:'Conferir estoque físico e vínculo dos anúncios',
  identity_review:'Confirmar se são o mesmo produto/variante',
  identical_mirrors:'Cadastros semelhantes; escolher o principal',
}
const base='/api/integracoes/marketplaces/estoque/auditoria'
const getJSON=async<T,>(path:string):Promise<T>=>{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store'})
  const json=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(json?.error||'A consulta falhou.')
  return json as T
}

export function SkuReconciliationAudit() {
  const [audit,setAudit]=useState<Audit|null>(null)
  const [checking,setChecking]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [all,setAll]=useState(false)
  const [testing,setTesting]=useState(false)
  const [channels,setChannels]=useState<{ml:ChannelResult;amazon:ChannelResult}|null>(null)

  async function consultar(){
    setChecking(true)
    try{
      setAudit(await getJSON<Audit>(base))
    }catch(e){toast.error(e instanceof Error?e.message:'Falha ao consultar SKUs.')}
    finally{setChecking(false)}
  }
  async function exportCSV(){
    setExporting(true)
    try{
      const response=await fetch(base+'?format=csv',{credentials:'same-origin',cache:'no-store'})
      if(!response.ok)throw new Error('Não foi possível gerar o CSV.')
      const url=URL.createObjectURL(await response.blob())
      const a=document.createElement('a')
      a.href=url
      a.download='matilha-prado-conciliacao-skus.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(()=>URL.revokeObjectURL(url),5000)
      toast.success('Relatório gerado. Importe a coluna SKU como texto para preservar zeros à esquerda.')
    }catch(e){toast.error(e instanceof Error?e.message:'Falha na exportação.')}
    finally{setExporting(false)}
  }
  async function testar(){
    setTesting(true)
    try{
      // Apenas GET: os dois endpoints já consultam o catálogo remoto com
      // credenciais do servidor, sem vender, mudar estoque ou ativar anúncio.
      const [ml,amazon]=await Promise.all([
        getJSON<ChannelResult>('/api/integracoes/mercado-livre/status'),
        getJSON<ChannelResult>('/api/integracoes/amazon/status'),
      ])
      setChannels({ml,amazon})
    }catch(e){toast.error(e instanceof Error?e.message:'Falha na consulta real às APIs.')}
    finally{setTesting(false)}
  }
  return <Card className="border-amber-200">
    <CardContent className="space-y-3 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4"/>Auditoria de estoque e conexões ML/Amazon
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Só leitura. Nenhuma quantidade será corrigida, anúncio reativado ou SKU fundido automaticamente.
          A equipe confirma o estoque físico e identifica cada variação antes de habilitar a escrita.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={()=>void consultar()} disabled={checking}>
          <RefreshCw className={checking?'mr-1 size-4 animate-spin':'mr-1 size-4'}/>
          {checking?'Consultando...':'Conferir SKUs do Hub'}
        </Button>
        <Button variant="outline" size="sm" onClick={()=>void testar()} disabled={testing}>
          <CheckCircle2 className="mr-1 size-4"/>
          {testing?'Testando conexões...':'Testar APIs em modo leitura'}
        </Button>
        {!!audit&&<Button variant="outline" size="sm" onClick={()=>void exportCSV()} disabled={exporting}>
          <Download className="mr-1 size-4"/>Exportar pendências (CSV)
        </Button>}
      </div>
      {channels&&<div className="grid gap-2 sm:grid-cols-2">
        {(['ml','amazon'] as const).map(channel=>{
          const info=channels[channel]
          const ok=info.connected&&info.catalogAccess
          return <div key={channel} className="rounded-lg border p-3 text-xs">
            <p className="font-semibold">{channel==='ml'?'Mercado Livre':'Amazon'}:
              {' '}{ok?'leitura confirmada':'conexão ou leitura pendente'}</p>
            <p className="mt-1 text-muted-foreground">{info.error||
              (ok?'Consulta autenticada do catálogo realizada com sucesso.':
                info.configured?'A conexão não confirmou acesso ao catálogo.':'Configuração incompleta.')}</p>
          </div>
        })}
      </div>}
      {audit&&<>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            {v:audit.summary.duplicateSkus,l:'SKUs duplicados'},
            {v:audit.summary.duplicateRows,l:'Cadastros envolvidos'},
            {v:audit.summary.differentStock,l:'Saldos divergentes'},
            {v:audit.summary.duplicateAsins,l:'ASINs duplicados'},
          ].map(x=><div key={x.l} className="rounded-lg bg-muted/50 p-2">
            <strong className="block text-lg">{x.v}</strong>
            <span className="text-xs text-muted-foreground">{x.l}</span>
          </div>)}
        </div>
        <p className="flex items-start gap-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0"/>
          {audit.pending.mercadoLivre} venda(s) ML e {audit.pending.amazon} venda(s) Amazon sem confirmação de baixa.
          Há {audit.summary.hubStockDivergences} cadastros com divergência entre estoque operacional e estoque Hub.
          Não some os saldos espelhados.
        </p>
        <div className="space-y-2">
          {audit.groups.slice(0,all?undefined:12).map(group=><details key={group.sku}
            className="rounded-lg border p-3">
            <summary className="cursor-pointer text-xs font-semibold">
              SKU {group.sku} · {group.items.length} cadastros · {descriptions[group.status]}
            </summary>
            <div className="mt-3 space-y-2">
              {group.items.map(p=><div key={p.id} className="rounded-lg bg-muted/40 p-2 text-xs">
                <p className="font-medium">{p.nome}</p>
                <p>Estoque: <strong>{p.estoque}</strong> · Hub: <strong>{p.estoqueHub}</strong>
                  {' '}· {p.ativo?'Publicado no Hub':'Oculto no Hub'}</p>
                <p className="break-all text-muted-foreground">
                  ML: {p.mlItemId||'Sem vínculo'} · Amazon: {p.amazonAsin||'Sem vínculo'}
                </p>
                <p className="break-all text-muted-foreground">Cadastro: {p.id}</p>
              </div>)}
            </div>
          </details>)}
          {audit.groups.length>12&&<Button variant="outline" size="sm"
            onClick={()=>setAll(v=>!v)}>
            {all?'Mostrar menos':`Ver todos os ${audit.groups.length} SKUs`}
          </Button>}
        </div>
        <p className="text-xs text-muted-foreground">
          Conferido em {new Date(audit.generatedAt).toLocaleString('pt-BR')}.
          Ações sobre estoque físico e anúncios continuam exigindo validação do gestor.
        </p>
      </>}
    </CardContent>
  </Card>
}
