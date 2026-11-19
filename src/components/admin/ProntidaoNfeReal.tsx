'use client'
import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
type Painel={
 nota1:{status:string;codigoSefaz:number|null;precisaConsulta:boolean}
 autorizadasHomologacao:{serie:number;numero:number;codigoSefaz:number|null}[]
 seriesConhecidas:{serie:number;quantidade:number;maiorConhecido:number;emissores:string[]}[]
 serieProducaoConfirmada:boolean;emissaoRealHabilitada:boolean;emailAutomatico:boolean
 regrasAtivas:number;pendencias:string[];aviso:string
}
export function ProntidaoNfeReal(){
 const [dados,setDados]=useState<Painel|null>(null)
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(false)
 async function atualizar(){
  setCarregando(true);setErro('')
  try{
   const r=await fetch('/api/admin/fiscal/prontidao-real',{cache:'no-store',credentials:'same-origin'})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Erro ao consultar acompanhamento.')
   setDados(j)
  }catch(e){setErro(e instanceof Error?e.message:'Consulta indisponível.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void atualizar()},[])
 return <section className="space-y-3 rounded-xl border p-4" aria-label="Acompanhamento de liberação NF-e">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h3 className="text-sm font-semibold">Liberação de NF-e real — acompanhamento</h3>
   <Button size="sm" variant="outline" type="button" disabled={carregando} onClick={()=>void atualizar()}>
    {carregando?'Conferindo…':'Atualizar situação'}
   </Button>
  </div>
  {erro&&<p role="alert" className="text-xs text-destructive">{erro}</p>}
  {dados&&<>
   <div className="grid gap-2 sm:grid-cols-3 text-xs">
    <div className="rounded-lg border p-3"><p className="text-muted-foreground">NF-e de homologação autorizadas</p>
     <p className="text-lg font-bold">{dados.autorizadasHomologacao.length}</p>
     <p>{dados.autorizadasHomologacao.map(x=>'S'+x.serie+'/N'+x.numero+' · '+x.codigoSefaz).join(' | ')||'Nenhuma'}</p></div>
    <div className="rounded-lg border p-3"><p className="text-muted-foreground">Teste nº 1</p>
     <p className="font-semibold">{dados.nota1.status} {dados.nota1.codigoSefaz?'· cStat '+dados.nota1.codigoSefaz:''}</p>
     <p>{dados.nota1.precisaConsulta?'Consultar mesma chave no histórico abaixo.':'Situação registrada.'}</p></div>
    <div className="rounded-lg border p-3"><p className="text-muted-foreground">NF-e real da Matilha Prado</p>
     <p className="font-semibold">{dados.emissaoRealHabilitada?'Habilitada':'Bloqueada até liberação técnica e fiscal'}</p>
     <p>{dados.regrasAtivas} regra(s) fiscal(is) ativa(s).</p></div>
   </div>
   <div className="rounded-lg border p-3 text-xs space-y-2">
    <p className="font-semibold">Numeração conhecida NO ERP (não é sequência oficial)</p>
    {dados.seriesConhecidas.map(s=><p key={s.serie}>
     Série {s.serie}: {s.quantidade} registro(s) · maior número conhecido {s.maiorConhecido} · emissor(es): {s.emissores.join(', ')}
    </p>)}
    <p className="text-muted-foreground">É obrigatório conferir notas autorizadas, canceladas e inutilizadas em outros emissores antes de reservar número real.</p>
   </div>
   <div className="rounded-lg border p-3 text-xs space-y-1">
    <p className="font-semibold">Pendências que ainda bloqueiam produção</p>
    {dados.pendencias.map((s,i)=><p key={i}>• {s}</p>)}
   </div>
   <p className="text-xs text-muted-foreground">{dados.aviso}</p>
  </>}
 </section>
}
