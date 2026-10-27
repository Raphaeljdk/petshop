'use client'

import {useCallback,useEffect,useState} from 'react'
import {AlertTriangle,CheckCircle2,ClipboardCheck,Loader2,RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'

type Preparo={
  tipo:string;modo:string;tpAmbPlanejado:number
  criacaoDeVenda:boolean;alteracaoDeEstoque:boolean;envioSefaz:boolean
  liberadoParaTransmitir:boolean
  produto:null|{
    nome:string;sku:string|null;ativo:boolean;ncm:string|null;gtinFiscal:string|null
    cfop:string|null;csosn:string|null;pisCst:string|null;cofinsCst:string|null
    cest:string|null;origem:string|null;unidadeFiscal:string|null
  }
  emitente:{crt:string|null;uf:string|null;serieCadastrada:number|null
    ambienteAtual:string|null;a1VariaveisPresentes:boolean}
  historico:{notasComNumeroNaSerie:number;maiorNumeroConhecidoNaSerie:number|null
    quantidadeNotasEmitidasPorMarketplace:number;numeroProximoConfirmado:boolean;observacao:string}
  regrasRevisadasCadastradas:number
  pendencias:string[]
}

/** Somente consulta. Não possui botão para criar venda, alterar estoque ou transmitir NF-e. */
export function PreparoHomologacaoNfe(){
  const [data,setData]=useState<Preparo|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(true)
  const atualizar=useCallback(async()=>{
    setBusy(true);setError('')
    try{
      const response=await fetch('/api/admin/fiscal/homologacao/preparo',{cache:'no-store',credentials:'same-origin'})
      const body=await response.json()
      if(!response.ok)throw Error(body.error||'Não foi possível consultar o preparo.')
      setData(body)
    }catch(err){setError(err instanceof Error?err.message:'Falha na consulta.')}
    finally{setBusy(false)}
  },[])
  useEffect(()=>{void atualizar()},[atualizar])
  return <section className="space-y-3 rounded-xl border border-amber-500/30 bg-muted/20 p-4" aria-label="Preparação da primeira NF-e de homologação">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4"/> Primeira NF-e em homologação — preparo</h3>
        <p className="text-xs text-muted-foreground">Diagnóstico sem movimentar estoque, criar vendas ou enviar documentos à SEFAZ.</p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>void atualizar()}>
        {busy?<Loader2 className="mr-1 size-4 animate-spin"/>:<RefreshCw className="mr-1 size-4"/>}Verificar
      </Button>
    </div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {data&&<>
      <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-4"/> Emissão própria bloqueada até homologação técnica, fiscal e numeração revisadas.
      </p>
      {data.produto?<div className="rounded-lg border bg-background p-3 text-xs">
        <p className="font-semibold">Produto selecionado para consulta ao contador</p>
        <p className="mt-1">{data.produto.nome}</p>
        <p className="mt-1 text-muted-foreground">
          SKU/GTIN: {data.produto.sku||'pendente'} · NCM: {data.produto.ncm||'pendente'} · CFOP cadastrado: {data.produto.cfop||'pendente'} · CSOSN: {data.produto.csosn||'pendente'}
        </p>
        <p className="mt-1 text-muted-foreground">PIS: {data.produto.pisCst||'pendente'} · COFINS: {data.produto.cofinsCst||'pendente'} · CEST: {data.produto.cest||'não informado (verificar aplicabilidade)'}</p>
      </div>:<p className="text-xs text-amber-700">Nenhum produto elegível foi localizado.</p>}
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">Série cadastrada</p><p className="font-semibold">{data.emitente.serieCadastrada??'Não definida'}</p><p className="text-muted-foreground">Ambiente atual: {data.emitente.ambienteAtual||'não informado'}</p></div>
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">Maior NF-e conhecida no ERP (na série)</p><p className="font-semibold">{data.historico.maiorNumeroConhecidoNaSerie??'Não há'}</p><p className="text-muted-foreground">Não é o próximo número autorizado</p></div>
        <div className="rounded-lg border bg-background p-3"><p className="text-muted-foreground">Regras tributárias aprovadas no banco</p><p className="font-semibold">{data.regrasRevisadasCadastradas}</p><p className="text-muted-foreground">{data.emitente.a1VariaveisPresentes?'A1 configurado (não valida assinatura)':'A1 não configurado'}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">{data.historico.observacao}</p>
      <details className="rounded-lg border bg-background p-3 text-xs" open>
        <summary className="cursor-pointer font-semibold">Pendências para a primeira autorização ({data.pendencias.length})</summary>
        <div className="mt-2 space-y-2">
          {data.pendencias.map(p=><p key={p} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600"/>{p}</p>)}
        </div>
      </details>
      <p className="flex gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 shrink-0"/>
        Esta consulta não altera compras, saldos, preços ou notas. Após aprovação contábil e conclusão técnica, o teste deve ocorrer exclusivamente no ambiente 2.
      </p>
    </>}
  </section>
}
