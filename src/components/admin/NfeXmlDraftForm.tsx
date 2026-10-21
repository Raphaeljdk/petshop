'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FiscalItem = {
  produtoId:string;nome:string;quantidade:number;
  ncm:string|null;cfop:string|null;csosn:string|null;
  pisCst:string;cofinsCst:string
}
type DraftData = {
  serie:number;nome:string;documento:string;enderecoTexto:string;cep:string;
  itens:Array<Omit<FiscalItem,'pisCst'|'cofinsCst'>>;aviso:string
}
type Endereco = {logradouro:string;numero:string;bairro:string;municipio:string;codigoMunicipio:string;uf:string;cep:string}
const vazio:Endereco = {logradouro:'',numero:'',bairro:'',municipio:'',codigoMunicipio:'',uf:'',cep:''}
const CST = ['04','05','06','07','08','09']
const nomes:Record<keyof Endereco,string> = {
  logradouro:'Rua / avenida',numero:'Número',bairro:'Bairro',municipio:'Cidade',
  codigoMunicipio:'Código IBGE (7 dígitos)',uf:'UF',cep:'CEP (8 dígitos)',
}

export function NfeXmlDraftForm({vendaId,onClose}:{vendaId:string;onClose:()=>void}) {
  const [dados,setDados]=useState<DraftData|null>(null)
  const [erro,setErro]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [numero,setNumero]=useState('')
  const [codigo,setCodigo]=useState('')
  const [natureza,setNatureza]=useState('')
  const [nome,setNome]=useState('')
  const [documento,setDocumento]=useState('')
  const [endereco,setEndereco]=useState<Endereco>(vazio)
  const [pagamento,setPagamento]=useState('17')
  const [frete,setFrete]=useState('9')
  const [itens,setItens]=useState<FiscalItem[]>([])
  useEffect(()=>{
    let ativo=true
    fetch('/api/admin/fiscal/xml-oficial?vendaId='+encodeURIComponent(vendaId),{cache:'no-store'})
      .then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Falha ao carregar pedido.');return body as DraftData})
      .then(d=>{if(!ativo)return;setDados(d);setNome(d.nome);setDocumento(d.documento.replace(/\D/g,''))
        setEndereco(p=>({...p,cep:(d.cep||'').replace(/\D/g,'')}))
        setItens(d.itens.map(i=>({...i,pisCst:'',cofinsCst:''})))
      }).catch(e=>{if(ativo)setErro(e instanceof Error?e.message:'Falha de conexão.')})
      .finally(()=>{if(ativo)setLoading(false)})
    return ()=>{ativo=false}
  },[vendaId])
  const alterarEndereco=(chave:keyof Endereco,valor:string)=>
    setEndereco(e=>({...e,[chave]:chave==='uf'?valor.toUpperCase():valor}))
  const alterarItem=(index:number,chave:'pisCst'|'cofinsCst',valor:string)=>
    setItens(lista=>lista.map((i,n)=>n===index?{...i,[chave]:valor}:i))
  async function baixar(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setErro('');setSaving(true)
    try {
      const response=await fetch('/api/admin/fiscal/xml-oficial',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          vendaId,numero:Number(numero),codigoNumerico:codigo,naturezaOperacao:natureza,
          destinatario:{nome,documento:documento.replace(/\D/g,''),endereco:{
            ...endereco,codigoMunicipio:endereco.codigoMunicipio.replace(/\D/g,''),
            cep:endereco.cep.replace(/\D/g,''),
          }},pagamento,modalidadeFrete:frete,
          itens:itens.map(i=>({produtoId:i.produtoId,pisCst:i.pisCst,cofinsCst:i.cofinsCst})),
        }),
      })
      if(!response.ok){
        const body=await response.json().catch(()=>({}))
        throw new Error(body.error||'Não foi possível montar o XML.')
      }
      const url=URL.createObjectURL(await response.blob())
      const a=document.createElement('a');a.href=url
      a.download='RASCUNHO-NFE55-HOMOLOGACAO-'+vendaId.replace(/[^a-zA-Z0-9_-]/g,'')+'.xml'
      document.body.appendChild(a);a.click();a.remove()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
    }catch(e){setErro(e instanceof Error?e.message:'Erro desconhecido.')}
    finally{setSaving(false)}
  }
  return <div className="w-full rounded-xl border border-amber-400/50 bg-muted/20 p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Rascunho XML no leiaute NF-e 4.00 (modelo 55)</h3>
        <p className="text-xs text-muted-foreground">Somente homologação (tpAmb=2). Ainda não há assinatura digital, validação XSD 010f, IBS/CBS completo ou transmissão SEFAZ.</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar formulário"><X className="size-4"/></Button>
    </div>
    {loading?<p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin"/>Carregando dados fiscais...</p>:
      dados&&<form className="space-y-4" onSubmit={baixar}>
        <p className="rounded-md border p-3 text-xs"><AlertTriangle className="mr-1 inline size-3"/>
          O contador deve confirmar que a operação usa CRT 1, CSOSN 102/103/300/400, CST PIS/COFINS não tributado, CFOP por UF e regras IBS/CBS. Este arquivo <strong>não é uma nota autorizada</strong> e não reserva número nem chave.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Série cadastrada</Label>
            <Input value={String(dados.serie)} readOnly/></div>
          <div className="space-y-1"><Label htmlFor={'nfe-num-'+vendaId}>Número de teste</Label>
            <Input id={'nfe-num-'+vendaId} type="number" min="1" max="999999999" required value={numero} onChange={e=>setNumero(e.target.value)} placeholder="Confirmar com contador"/></div>
          <div className="space-y-1"><Label htmlFor={'nfe-cnf-'+vendaId}>cNF: 8 dígitos</Label>
            <div className="flex gap-2"><Input id={'nfe-cnf-'+vendaId} required maxLength={8} value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="8 dígitos"/>
              <Button type="button" size="sm" variant="outline" onClick={()=>{
                const value=crypto.getRandomValues(new Uint32Array(1))[0]%100000000
                setCodigo(String(value).padStart(8,'0'))
              }}>Gerar</Button></div>
          </div>
        </div>
        <div className="space-y-1"><Label>Natureza da operação (validar com contador)</Label>
          <Input value={natureza} onChange={e=>setNatureza(e.target.value)} maxLength={60} required placeholder="Ex.: venda de mercadoria adquirida de terceiros"/></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Nome do destinatário</Label>
            <Input required value={nome} onChange={e=>setNome(e.target.value)}/></div>
          <div className="space-y-1"><Label>CPF/CNPJ do destinatário</Label>
            <Input required value={documento} onChange={e=>setDocumento(e.target.value.replace(/\D/g,'').slice(0,14))} placeholder="Somente números"/></div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Endereço completo do destinatário</p>
          {dados.enderecoTexto&&<p className="mb-2 text-xs text-muted-foreground">Endereço original da venda (confira antes de dividir os campos): {dados.enderecoTexto}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(nomes) as Array<keyof Endereco>).map(k=>
              <div key={k} className="space-y-1"><Label>{nomes[k]}</Label>
                <Input required value={endereco[k]} onChange={e=>alterarEndereco(k,e.target.value)}
                  maxLength={k==='cep'?8:k==='codigoMunicipio'?7:k==='uf'?2:60}/></div>)}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Pagamento registrado (conferir)</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={pagamento} onChange={e=>setPagamento(e.target.value)}>
              <option value="17">17 — Pix</option><option value="01">01 — Dinheiro</option><option value="18">18 — Transferência bancária</option>
            </select></div>
          <div className="space-y-1"><Label>Modalidade do frete</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={frete} onChange={e=>setFrete(e.target.value)}>
              <option value="9">9 — Sem transporte</option><option value="0">0 — Por conta do remetente</option>
              <option value="1">1 — Por conta do destinatário</option><option value="2">2 — Por conta de terceiros</option>
            </select></div>
        </div>
        <div className="space-y-2"><p className="text-sm font-semibold">Tributação por item (confirmar com contador)</p>
          {itens.map((i,index)=><div key={i.produtoId+'-'+index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div><p className="text-sm font-medium">{i.nome} · {i.quantidade} un.</p>
              <p className="text-xs text-muted-foreground">NCM: {i.ncm||'PENDENTE'} · CFOP: {i.cfop||'PENDENTE'} · CSOSN: {i.csosn||'PENDENTE'}</p></div>
            <div className="space-y-1"><Label>CST PIS</Label>
              <select required className="h-10 w-full rounded-md border bg-background px-2" value={i.pisCst} onChange={e=>alterarItem(index,'pisCst',e.target.value)}>
                <option value="">Selecionar</option>{CST.map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="space-y-1"><Label>CST COFINS</Label>
              <select required className="h-10 w-full rounded-md border bg-background px-2" value={i.cofinsCst} onChange={e=>alterarItem(index,'cofinsCst',e.target.value)}>
                <option value="">Selecionar</option>{CST.map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>)}
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300">O XML é somente um rascunho estrutural para conferência técnica. Não encaminhar ao autorizador enquanto XSD, assinatura, IBS/CBS e demais hipóteses fiscais não estiverem homologados.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>{saving?<Loader2 className="mr-2 size-4 animate-spin"/>:<Download className="mr-2 size-4"/>}Baixar rascunho XML NF-e 55</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </form>}
    {erro&&<p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
  </div>
}
