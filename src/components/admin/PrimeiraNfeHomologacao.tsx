'use client'

import {useCallback,useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

type NotaTeste={
 id:string;serie:number;numero:number;chave:string;status:string
 codigoSefaz?:number|null;motivoSefaz?:string|null;protocolo?:string|null;recibo?:string|null
}
const initial={
 nome:'',documento:'',logradouro:'',numero:'',bairro:'',municipio:'São Paulo',
 codigoMunicipio:'3550308',cep:'',valorUnitario:'',quantidade:'1',
 pisBase:'',pisAliquota:'',pisValor:'',cofinsBase:'',cofinsAliquota:'',cofinsValor:'',
}
const txt=(v:string)=>v.replace(/\D/g,'')
export function PrimeiraNfeHomologacao(){
 const [form,setForm]=useState(initial)
 const [notas,setNotas]=useState<NotaTeste[]>([])
 const [loading,setLoading]=useState(false)
 const [erro,setErro]=useState('')
 const [sucesso,setSucesso]=useState('')
 const [aceitaEnvio,setAceitaEnvio]=useState(false)
 const atualizar=useCallback(async()=>{
  const res=await fetch('/api/admin/fiscal/homologacao/nfe',{cache:'no-store'})
  const json=await res.json()
  if(!res.ok)throw new Error(json.error||'Não foi possível listar notas de teste.')
  setNotas(json.documentos)
 },[])
 useEffect(()=>{atualizar().catch(e=>setErro(e.message))},[atualizar])
 const field=(key:keyof typeof initial,label:string,type='text',step?:string)=>
  <div className="space-y-1" key={key}>
   <Label>{label}</Label>
   <Input value={form[key]} type={type} min={type==='number'?'0':undefined}
    step={step} required
    onChange={e=>setForm(f=>({...f,[key]:key==='documento'||key==='cep'||key==='codigoMunicipio'
     ?txt(e.target.value):e.target.value}))}/>
  </div>
 async function acao(body:unknown){
  setErro('');setSucesso('');setLoading(true)
  try{
   const res=await fetch('/api/admin/fiscal/homologacao/nfe',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),
   })
   const json=await res.json()
   if(!res.ok)throw new Error(json.error||'Operação fiscal não concluída.')
   setSucesso(json.aviso||(
    json.status==='autorizada'
     ?'SEFAZ autorizou a nota de TESTE. Protocolo: '+json.protocolo
     :'Situação: '+json.status+' · cStat '+(json.codigoSefaz??'não recebido')
   ))
   await atualizar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar SEFAZ.')}
  finally{setLoading(false)}
 }
 async function preparar(e:React.FormEvent){
  e.preventDefault()
  const vals=[form.valorUnitario,form.quantidade,form.pisBase,form.pisAliquota,form.pisValor,
   form.cofinsBase,form.cofinsAliquota,form.cofinsValor]
  if(vals.some(s=>s.trim()==='')){setErro('Todos os valores fiscais devem ser explicitamente preenchidos.');return}
  if(!/^(?:\d{11}|\d{14})$/.test(form.documento)){setErro('CPF/CNPJ do destinatário inválido.');return}
  await acao({acao:'preparar',confirmacao:'PREPARAR TESTE',
   valorUnitario:Number(form.valorUnitario),quantidade:Number(form.quantidade),
   pis:{base:Number(form.pisBase),aliquota:Number(form.pisAliquota),valor:Number(form.pisValor)},
   cofins:{base:Number(form.cofinsBase),aliquota:Number(form.cofinsAliquota),valor:Number(form.cofinsValor)},
   destinatario:{nome:form.nome,documento:form.documento,
    endereco:{logradouro:form.logradouro,numero:form.numero,bairro:form.bairro,
     municipio:form.municipio,codigoMunicipio:form.codigoMunicipio,uf:'SP',cep:form.cep}},
  })
 }
 return <div className="space-y-4 rounded-xl border border-amber-500/40 p-4" aria-label="NF-e de teste SEFAZ">
  <div className="space-y-1">
   <h3 className="text-base font-semibold">Primeira NF-e 55 — somente HOMOLOGAÇÃO</h3>
   <p className="text-xs text-muted-foreground">
    Utiliza exclusivamente a Strong Ball Pequena Laranja aprovada. Teste sem validade fiscal,
    sem venda real e sem movimentar estoque. Série 2 e numeração de homologação isolada.
   </p>
  </div>
  <form className="space-y-3" onSubmit={preparar}>
   <div className="grid gap-3 sm:grid-cols-3">
    {field('quantidade','Quantidade do teste','number','1')}
    {field('valorUnitario','Valor unitário de teste (R$)','number','0.01')}
   </div>
   <p className="font-semibold text-sm">Destinatário para o teste</p>
   <div className="grid gap-3 sm:grid-cols-3">
    {field('nome','Nome do destinatário')}
    {field('documento','CPF ou CNPJ (só números)')}
    {field('cep','CEP (8 dígitos)')}
    {field('logradouro','Logradouro')}
    {field('numero','Número do endereço')}
    {field('bairro','Bairro')}
    {field('municipio','Município')}
    {field('codigoMunicipio','Código IBGE (7 dígitos)')}
   </div>
   <p className="font-semibold text-sm">CST 49 — valores expressamente aprovados</p>
   <p className="text-xs text-amber-700 dark:text-amber-300">
    Não presuma alíquota ou valor zerado. Informe bases, percentuais e valores que a contadora
    validou para o teste. O sistema confere os cálculos.
   </p>
   <div className="grid gap-3 sm:grid-cols-3">
    {field('pisBase','Base PIS (R$)','number','0.01')}
    {field('pisAliquota','Alíquota PIS (%)','number','0.0001')}
    {field('pisValor','Valor PIS (R$)','number','0.01')}
    {field('cofinsBase','Base COFINS (R$)','number','0.01')}
    {field('cofinsAliquota','Alíquota COFINS (%)','number','0.0001')}
    {field('cofinsValor','Valor COFINS (R$)','number','0.01')}
   </div>
   <Button type="submit" disabled={loading}>
    {loading?'Validando...':'Preparar e assinar nota de teste'}
   </Button>
  </form>
  <div className="space-y-2">
   <div className="flex items-center justify-between gap-3">
    <p className="text-sm font-semibold">Histórico isolado de homologação</p>
    <Button type="button" size="sm" variant="outline" disabled={loading}
     onClick={()=>atualizar().catch(e=>setErro(e.message))}>Atualizar</Button>
   </div>
   {notas.length===0&&<p className="text-xs text-muted-foreground">Nenhuma NF-e de teste preparada.</p>}
   <div className="flex items-start gap-2 text-xs">
    <input type="checkbox" checked={aceitaEnvio} onChange={e=>setAceitaEnvio(e.target.checked)}/>
    <span>Confirmo que desejo transmitir uma NF-e de TESTE ao ambiente de homologação da SEFAZ-SP.
     A transmissão não poderá ser tratada como nota de produção.</span>
   </div>
   {notas.map(n=><div key={n.id} className="rounded-lg border p-3 text-xs space-y-2">
    <p><strong>Série {n.serie}, número {n.numero}</strong> · {n.status}
     {n.codigoSefaz?' · cStat '+n.codigoSefaz:''}</p>
    <p className="break-all text-muted-foreground">Chave: {n.chave}</p>
    {n.protocolo&&<p>Protocolo SEFAZ: {n.protocolo}</p>}
    {n.status==='autorizada'&&<a className="text-blue-600 underline" href={'/api/admin/fiscal/homologacao/nfe/xml?id='+encodeURIComponent(n.id)} download>Baixar XML autorizado (somente homologação)</a>}
    {n.motivoSefaz&&<p>{n.motivoSefaz}</p>}
    <div className="flex gap-2 flex-wrap">
     {n.status==='preparada'&&<Button type="button" size="sm" disabled={loading||!aceitaEnvio}
      onClick={()=>acao({acao:'transmitir',id:n.id,confirmacao:'TRANSMITIR HOMOLOGACAO'})}>
      Transmitir teste à SEFAZ</Button>}
     {!['preparada','autorizada'].includes(n.status)&&<Button type="button" size="sm"
      variant="outline" disabled={loading} onClick={()=>acao({acao:'consultar',id:n.id})}>
      Consultar situação na SEFAZ</Button>}
    </div>
   </div>)}
  </div>
  {sucesso&&<p role="status" className="text-sm text-emerald-600">{sucesso}</p>}
  {erro&&<p role="alert" className="text-sm text-red-600">{erro}</p>}
 </div>
}
