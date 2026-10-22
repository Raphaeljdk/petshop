'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Search, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { LABELS_ALIQUOTAS } from '@/lib/fiscal-consulta-automatica'

type Produto = {
  id:string;nome:string; ncm:string|null;cfop:string|null;origem:string|null
  cest:string|null;csosn:string|null;pisCst:string|null;cofinsCst:string|null
  ipiCst:string|null;ibsCbsCst:string|null;ibsCbsClassTrib:string|null
}
type Regra = {
  id:string; ncm:string;cfop:string;origem:string;ufDestino:string;indicadorIE:string
  cest:string|null;csosn:string;pisCst:string;cofinsCst:string
  ipiCst:string|null;ibsCbsCst:string|null;ibsCbsClassTrib:string|null
  contadorResponsavel:string;referencia:string;aprovadoEm:string;observacoes:string|null
} & Partial<Record<keyof typeof LABELS_ALIQUOTAS,number|null>>

type Resultado = {status:string;regra:Regra|null;mensagem:string}
type CamposAplicados=Pick<Regra,'cfop'|'origem'|'cest'|'csosn'|'pisCst'|'cofinsCst'|'ipiCst'|'ibsCbsCst'|'ibsCbsClassTrib'>
type TaxaKey=keyof typeof LABELS_ALIQUOTAS
const taxaKeys=Object.keys(LABELS_ALIQUOTAS) as TaxaKey[]
const iniciais=Object.fromEntries(taxaKeys.map(k=>[k,''])) as Record<TaxaKey,string>

export function ConsultaAutomaticaTributaria({
  produto,aoAplicar,
}:{produto:Produto;aoAplicar:(campos:CamposAplicados)=>void}){
  const [resultado,setResultado]=useState<Resultado|null>(null)
  const [carregando,setCarregando]=useState(false)
  const [revisao,setRevisao]=useState(0)
  const [abrirRegistro,setAbrirRegistro]=useState(false)
  const [nomeContador,setNomeContador]=useState('')
  const [referencia,setReferencia]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [conferido,setConferido]=useState(false)
  const [taxas,setTaxas]=useState<Record<TaxaKey,string>>(iniciais)
  const [salvando,setSalvando]=useState(false)

  const ncm=(produto.ncm||'').replace(/\D/g,'')
  const cfop=(produto.cfop||'').replace(/\D/g,'')
  const origem=produto.origem||''
  useEffect(()=>{
    if(!/^\d{8}$/.test(ncm)){
      setResultado(null);setCarregando(false);return
    }
    const controller=new AbortController()
    setCarregando(true)
    const tempo=setTimeout(()=>{
      const qs=new URLSearchParams({ncm,cfop,origem,ufDestino:'SP',indicadorIE:'9'})
      fetch('/api/admin/fiscal/regras?'+qs,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
        .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||data.mensagem);return data as Resultado})
        .then(data=>{if(!controller.signal.aborted)setResultado(data)})
        .catch(e=>{if(!controller.signal.aborted)setResultado({status:'erro',regra:null,mensagem:e instanceof Error?e.message:'Erro na consulta fiscal.'})})
        .finally(()=>{if(!controller.signal.aborted)setCarregando(false)})
    },350)
    return ()=>{clearTimeout(tempo);controller.abort()}
  },[ncm,cfop,origem,revisao])

  const taxaInformadas=resultado?.regra?
    taxaKeys.filter(k=>typeof resultado.regra?.[k]==='number'):[]

  async function registrar(){
    if(!conferido)return toast.error('Confirme que os dados foram revisados com o contador.')
    if(!nomeContador.trim()||!referencia.trim())return toast.error('Informe o contador e a referência normativa ou parecer utilizado.')
    if(!/^\d{8}$/.test(ncm)||!/^5\d{3}$/.test(cfop)||!/^[0-8]$/.test(origem))
      return toast.error('A consulta inicial exige NCM, CFOP 5xxx e origem válidos para venda interna SP.')
    setSalvando(true)
    try{
      const dadosTaxa=Object.fromEntries(taxaKeys.map(k=>[k,taxas[k].trim()===''?null:Number(taxas[k].replace(',','.'))]))
      const res=await fetch('/api/admin/fiscal/regras',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          ncm,cfop,origem,ufDestino:'SP',indicadorIE:'9',
          cest:produto.cest||null,csosn:produto.csosn||'',
          pisCst:produto.pisCst||'',cofinsCst:produto.cofinsCst||'',
          ipiCst:produto.ipiCst||null,ibsCbsCst:produto.ibsCbsCst||null,
          ibsCbsClassTrib:produto.ibsCbsClassTrib||null,
          contadorResponsavel:nomeContador,referencia,observacoes:observacoes||null,
          ...dadosTaxa,confirmacao:'REVISADO_COM_CONTADOR',
        }),
      })
      const json=await res.json()
      if(!res.ok)throw Error(json.error||'Não foi possível registrar a regra.')
      toast.success('Regra cadastrada. Consulta automática disponível para produtos de mesmo escopo.')
      setAbrirRegistro(false);setConferido(false);setRevisao(r=>r+1)
    }catch(e){toast.error(e instanceof Error?e.message:'Falha na regra fiscal.')}
    finally{setSalvando(false)}
  }

  return <div className="space-y-3 rounded-lg border bg-background p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Search className="size-4"/> Consulta automática da tributação</p>
        <p className="text-xs text-muted-foreground">Operação inicial: revenda interna em SP, consumidor final não contribuinte. A busca é automática pela base de regras revisadas, não por alíquotas públicas em tempo real.</p>
      </div>
      <a className="inline-flex items-center gap-1 text-xs underline" target="_blank" rel="noopener noreferrer"
        href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/ncm">
        Consultar NCM na Receita <ExternalLink className="size-3"/>
      </a>
    </div>
    {!/^\d{8}$/.test(ncm)
      ? <p className="text-xs text-amber-700 dark:text-amber-300">Digite o NCM de 8 dígitos no formulário acima para começar a busca.</p>
      : carregando
        ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin"/> Buscando regras para NCM {ncm}...</p>
        : resultado
          ? <div className="space-y-2">
              <p className="flex items-start gap-2 text-xs">
                {resultado.regra?<CheckCircle2 className="size-4 shrink-0 text-green-600"/>:<AlertTriangle className="size-4 shrink-0 text-amber-600"/>}
                <span>{resultado.mensagem}</span>
              </p>
              {resultado.regra && <div className="space-y-2 rounded-lg border border-green-700/25 p-3">
                <p className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="size-4 text-green-600"/> Referência cadastrada e declarada revisada</p>
                <p className="text-xs text-muted-foreground">Contador: {resultado.regra.contadorResponsavel} · Referência: {resultado.regra.referencia}</p>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <span>CFOP: <strong>{resultado.regra.cfop}</strong></span>
                  <span>CSOSN: <strong>{resultado.regra.csosn}</strong></span>
                  <span>CEST: <strong>{resultado.regra.cest||'Não informado'}</strong></span>
                  <span>PIS CST: <strong>{resultado.regra.pisCst}</strong></span>
                  <span>COFINS CST: <strong>{resultado.regra.cofinsCst}</strong></span>
                  <span>IPI CST: <strong>{resultado.regra.ipiCst||'Não informado'}</strong></span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {taxaInformadas.length?taxaInformadas.map(k=><span key={k} className="rounded border px-2 py-1">
                    {LABELS_ALIQUOTAS[k]}: <strong>{resultado.regra?.[k]}%</strong>
                  </span>):<p className="text-amber-700 dark:text-amber-300">A regra não contém percentuais revisados. Nenhuma alíquota presumida.</p>}
                </div>
                <p className="text-xs text-muted-foreground">Esses percentuais são referências cadastradas, não cálculo do imposto da nota. A aplicação ainda exige conferência por operação.</p>
                <Button type="button" variant="outline" size="sm" onClick={()=>{const r=resultado.regra;if(r)aoAplicar({
                  cfop:r.cfop,origem:r.origem,cest:r.cest,csosn:r.csosn,
                  pisCst:r.pisCst,cofinsCst:r.cofinsCst,ipiCst:r.ipiCst,
                  ibsCbsCst:r.ibsCbsCst,ibsCbsClassTrib:r.ibsCbsClassTrib,
                })}}>Aplicar códigos ao formulário (sem salvar)</Button>
              </div>}
            </div>
          : <p className="text-xs text-muted-foreground">Consulta aguardando os campos do produto.</p>}
    {resultado?.status==='sem_regra' && <div className="space-y-3">
      <Button variant="outline" size="sm" type="button" onClick={()=>setAbrirRegistro(p=>!p)}>
        {abrirRegistro?'Fechar cadastro de regra':'Cadastrar regra revisada com contador'}
      </Button>
      {abrirRegistro && <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold">Registrar regra para NCM {ncm} · CFOP {cfop} · SP · consumidor final não contribuinte</p>
        <p className="text-xs text-muted-foreground">Os códigos vêm do produto acima. Insira somente percentuais expressamente confirmados pelo contador; deixe vazios os não aplicáveis ou ainda não verificados. Não use 0 para significar “desconhecido”.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label>Nome do contador responsável</Label><Input value={nomeContador} onChange={e=>setNomeContador(e.target.value)} placeholder="Nome responsável pela conferência"/></div>
          <div><Label>Fundamento / referência da contabilidade</Label><Input value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Planilha, parecer, norma ou orientação"/></div>
          {taxaKeys.map(k=><div key={k}>
            <Label>{LABELS_ALIQUOTAS[k]} (%) — opcional</Label>
            <Input inputMode="decimal" value={taxas[k]} onChange={e=>setTaxas(p=>({...p,[k]:e.target.value}))} placeholder="Não informado"/>
          </div>)}
          <div className="sm:col-span-2"><Label>Observações da regra</Label><Input value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Ex.: produto específico, exceção ou justificativa"/></div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <Checkbox checked={conferido} onCheckedChange={v=>setConferido(v===true)}/>
          <span>Confirmo que esta classificação e os percentuais informados foram revisados com o contador para a operação específica indicada acima.</span>
        </label>
        <Button type="button" size="sm" disabled={!conferido||salvando||!nomeContador.trim()||!referencia.trim()}
          onClick={registrar}>{salvando?<Loader2 className="mr-2 size-4 animate-spin"/>:null}Salvar regra revisada</Button>
      </div>}
    </div>}
    <p className="text-xs text-muted-foreground">Sem regra revisada, o item permanece pendente. O sistema não consulta automaticamente alíquotas oficiais, não calcula DAS e não transmite NF-e.</p>
  </div>
}
