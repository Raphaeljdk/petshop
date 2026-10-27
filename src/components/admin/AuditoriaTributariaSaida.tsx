'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AuditoriaFiscal = {
  resumo:{
    totalAnuncios:number;comAlgumCodigoSaida:number;camposBasicosInformados:number
    porCfop:Array<{codigo:string;quantidade:number}>
    entradaEmVenda:number;especiaisRevisar:number
    comPis49:number;comCofins49:number
    regrasRevisadasAtivas:number;emissorProprioAutorizado:boolean
    divergenciasCfop:Array<{sku:string;codigos:string[]}>
  }
  alertas:Array<{
    produtoId:string;sku:string|null;nome:string;codigo:string
    severidade:string;detalhe:string
  }>
  aviso:string
}

/** Painel de diagnóstico somente leitura. Nenhuma alíquota é calculada aqui. */
export function AuditoriaTributariaSaida(){
  const [data,setData]=useState<AuditoriaFiscal|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const consultar=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const result=await fetch('/api/admin/fiscal/auditoria-saida',{
        cache:'no-store',credentials:'same-origin',
      })
      const json=await result.json()
      if(!result.ok)throw Error(json.error||'Não foi possível carregar o diagnóstico.')
      setData(json)
    }catch(e){setError(e instanceof Error?e.message:'Falha de consulta.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void consultar()},[consultar])
  const r=data?.resumo
  return <section aria-label="Auditoria de CFOP, PIS e COFINS" className="space-y-3 rounded-xl border bg-muted/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4"/> Conferência tributária de saída (NF-e 55)
        </h3>
        <p className="text-xs text-muted-foreground">Compara os códigos atuais com regras formais de entrada/saída. Não substitui revisão de tributação por venda, nem autoriza emissão.</p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>void consultar()}>
        {loading?<Loader2 className="mr-2 size-3 animate-spin"/>:<RefreshCw className="mr-2 size-3"/>}Atualizar diagnóstico
      </Button>
    </div>
    {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
    {r&&<div className="space-y-3">
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">Anúncios com códigos fiscais</p><p className="text-xl font-semibold tabular-nums">{r.comAlgumCodigoSaida}</p></div>
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">CFOPs de entrada em cadastro de venda</p><p className="text-xl font-semibold tabular-nums">{r.entradaEmVenda}</p></div>
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">CFOPs especiais para revisar</p><p className="text-xl font-semibold tabular-nums">{r.especiaisRevisar}</p></div>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300">
        {r.comPis49} anúncios com PIS CST 49; {r.comCofins49} com COFINS CST 49.
        Esses códigos existem na legislação, mas não são suportados pelo gerador XML atual (que usa somente CST 04–09).
        Não altere para 04–09 ou 99 automaticamente: precisamos do tratamento contábil e do grupo XML correto.
      </p>
      <p className="text-xs text-muted-foreground">
        CFOPs encontrados: {r.porCfop.map(x=>x.codigo+' ('+x.quantidade+')').join(' · ')}.
        Regras fiscais cadastradas como revisadas: {r.regrasRevisadasAtivas}.
      </p>
      {r.divergenciasCfop.length>0&&<p className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Mesmo SKU com CFOPs distintos: {r.divergenciasCfop.slice(0,8).map(x=>x.sku+' ('+x.codigos.join('/')+')').join(', ')}.
        Isso exige análise por operação e não deve ser copiado automaticamente.
      </p>}
      {data && data.alertas.length>0 && <details className="text-xs" open>
        <summary className="cursor-pointer font-medium">Ver registros que precisam de revisão ({data.alertas.length})</summary>
        <div className="mt-2 space-y-2">
          {data.alertas.map(x=><div key={x.produtoId+x.codigo} className="rounded-lg border border-amber-600/30 bg-background p-3">
            <p className="flex items-start gap-2 font-medium"><AlertTriangle className="size-4 shrink-0 text-amber-600"/> {x.nome}</p>
            <p className="mt-1 text-muted-foreground">SKU: {x.sku||'não informado'}</p>
            <p className="mt-1">{x.detalhe}</p>
          </div>)}
        </div>
      </details>}
      <p className="text-xs text-muted-foreground">{data?.aviso}</p>
    </div>}
  </section>
}
