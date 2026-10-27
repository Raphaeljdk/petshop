'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

type Resultado={
  hash:string
  resumo:{
    anuncios:number;skusDistintos:number;gruposDuplicados:number;gruposParaReaproveitar:number;
    anunciosComCamposDocumentaisVazios:number;preenchimentosPendentes:number;gruposParaConferencia:number
  }
  amostras:Array<{sku:string;anuncios:number;aplicaveis:number;campos:string[];bloqueios:string[];conflitosTributarios:string[]}>
  aviso:string;aplicados:number|null;camposPreenchidos?:number;ignorados?:number
}
export function ReaproveitarFiscalSku({onApplied}:{onApplied:()=>void}){
  const [preview,setPreview]=useState<Resultado|null>(null)
  const [busy,setBusy]=useState(false)
  const [confirmado,setConfirmado]=useState(false)
  async function consultar(modo:'simular'|'aplicar'){
    if(modo==='aplicar'&&(!preview||!confirmado)){
      toast.error('Confira a prévia e marque a confirmação.');return
    }
    setBusy(true)
    try{
      const res=await fetch('/api/admin/fiscal/consolidar-sku',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({modo,hash:preview?.hash,
          confirmacao:modo==='aplicar'?'AUTORIZO_APENAS_CAMPOS_DOCUMENTAIS':undefined}),
      })
      const data=await res.json()
      if(!res.ok)throw Error(data.error||'Erro no reaproveitamento fiscal.')
      setPreview(data)
      if(modo==='aplicar'){
        toast.success(data.aplicados+' anúncio(s) atualizados sem substituir dados preenchidos.')
        setConfirmado(false);onApplied()
      }
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível verificar os dados.')}
    finally{setBusy(false)}
  }
  const r=preview?.resumo
  return <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4"/> Reaproveitar dados entre anúncios do mesmo SKU</h3>
        <p className="text-xs text-muted-foreground">Preserva o preenchimento feito pelo Aleksander. Identificação por GTIN/SKU válido, sem mesclar preços, estoques ou operações fiscais diferentes.</p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy}
        onClick={()=>{setConfirmado(false);void consultar('simular')}}>
        {busy?<Loader2 className="mr-2 size-4 animate-spin"/>:<RefreshCw className="mr-2 size-4"/>}Conferir reaproveitamento
      </Button>
    </div>
    {preview&&r&&<div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="grid gap-3 text-xs sm:grid-cols-3">
        <div><p className="text-muted-foreground">SKUs distintos</p><p className="text-lg font-semibold tabular-nums">{r.skusDistintos}</p></div>
        <div><p className="text-muted-foreground">Anúncios que podem receber dados</p><p className="text-lg font-semibold tabular-nums">{r.anunciosComCamposDocumentaisVazios}</p></div>
        <div><p className="text-muted-foreground">Grupos com conflitos/checagem</p><p className="text-lg font-semibold tabular-nums">{r.gruposParaConferencia}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Prévia: {r.gruposParaReaproveitar} SKU(s), {r.preenchimentosPendentes} campos documentais vazios com referência existente. Os demais ficam pendentes de identificação ou revisão.</p>
      <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="size-4 shrink-0"/>{preview.aviso}</p>
      {preview.amostras.length>0&&<details className="text-xs">
        <summary className="cursor-pointer font-medium">Ver SKUs e motivos de revisão (até 100 grupos)</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          {preview.amostras.map(a=><div className="border-b py-2" key={a.sku}>
            <span className="font-mono font-medium">{a.sku}</span> · {a.anuncios} anúncios · {a.aplicaveis} atualizáveis
            {a.campos.length>0&&<span> · Campos: {a.campos.join(', ')}</span>}
            {a.bloqueios.length>0&&<p className="text-amber-700 dark:text-amber-300">Bloqueado: {a.bloqueios.join(' · ')}</p>}
            {a.conflitosTributarios.length>0&&<p className="text-amber-700 dark:text-amber-300">Revisar impostos: {a.conflitosTributarios.join(', ')}</p>}
          </div>)}
        </div>
      </details>}
      {preview.aplicados!=null
        ? <p className="flex items-center gap-2 text-xs font-medium text-green-700"><CheckCircle2 className="size-4"/>
            {preview.aplicados} anúncio(s) atualizados; {preview.camposPreenchidos} campo(s) preenchidos com auditoria.
          </p>
        : r.gruposParaReaproveitar>0&&<>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <Checkbox checked={confirmado} onCheckedChange={v=>setConfirmado(v===true)}/>
              <span>Conferi a simulação. Autorizo somente preencher NCM, CEST e GTIN já presentes em anúncios equivalentes, sem tocar em CFOP, CSOSN, PIS, COFINS ou estoque.</span>
            </label>
            <Button type="button" size="sm" disabled={!confirmado||busy||r.anunciosComCamposDocumentaisVazios>350}
              onClick={()=>void consultar('aplicar')}>
              {busy?<Loader2 className="mr-2 size-4 animate-spin"/>:null}
              Aplicar aos {r.anunciosComCamposDocumentaisVazios} anúncios incompletos
            </Button>
          </>}
    </div>}
  </div>
}
