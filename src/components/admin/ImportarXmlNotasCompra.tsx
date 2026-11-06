'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileCode2, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

type Escolha={linha:number;acao:'vincular'|'criar';produtoId?:string}
type Preview={
  arquivo:string;hash:string;jaImportada:boolean
  nota:{chave:string;numero:string;serie:string;fornecedor:string;cnpjFornecedor:string;autorizada:boolean;ambiente:string}
  totais:{linhas:number;aptas:number;jaPreenchidos:number;semVinculo:number;conflitos:number;revisar:number;duplicadas:number}
  linhas:Array<{linha:number;descricao:string;gtin:string|null;ncm:string;cest:string|null;status:string;motivo:string;produtoIds:string[]}>
  catalogo:Array<{id:string;nome:string;sku:string|null;gtinFiscal:string|null}>
  aviso:string;atualizados?:number;criados?:number;ignorados?:number
}
type Lote={id:string;arquivo:string;xml:string;preview:Preview|null;escolhas:Record<number,Escolha>;buscas:Record<number,string>;confirmado:boolean;concluido:boolean}
const numero=(n:number)=>n.toLocaleString('pt-BR')

export function ImportarXmlNotasCompra({onImported}:{onImported:()=>void}){
  const [lotes,setLotes]=useState<Lote[]>([])
  const [ocupado,setOcupado]=useState(false)
  function alterar(id:string,patch:Partial<Lote>){
    setLotes(current=>current.map(l=>l.id===id?{...l,...patch}:l))
  }
  async function carregar(event:React.ChangeEvent<HTMLInputElement>){
    const arquivos=Array.from(event.target.files||[])
    if(!arquivos.length)return
    if(arquivos.length>8||arquivos.some(f=>!f.name.toLowerCase().endsWith('.xml')||f.size>900_000)){
      toast.error('Selecione até oito arquivos .xml com no máximo 900 KB cada.');return
    }
    const rows=await Promise.all(arquivos.map(async(f,i)=>({
      id:String(i)+'-'+f.name+'-'+f.size,arquivo:f.name,xml:await f.text(),
      preview:null,escolhas:{},buscas:{},confirmado:false,concluido:false,
    } satisfies Lote)))
    setLotes(rows)
  }
  async function pedir(lote:Lote,modo:'simular'|'aplicar'){
    const res=await fetch('/api/admin/fiscal/importar-xml',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({xml:lote.xml,arquivo:lote.arquivo,modo,
        hash:lote.preview?.hash,confirmacao:modo==='aplicar'?'CONFIRMO_IMPORTACAO_XML':undefined,
        escolhas:modo==='aplicar'?Object.values(lote.escolhas):[]}),
    })
    const data=await res.json().catch(()=>({}))
    if(!res.ok)throw Error(data.error||'Falha na importação.')
    return data as Preview
  }
  async function simular(){
    if(!lotes.length)return
    setOcupado(true)
    for(const lote of lotes){
      try{const preview=await pedir(lote,'simular');alterar(lote.id,{preview,escolhas:{},confirmado:false,concluido:false})}
      catch(e){toast.error(lote.arquivo+': '+(e instanceof Error?e.message:'XML inválido.'))}
    }
    setOcupado(false)
  }
  async function aplicar(lote:Lote){
    if(!lote.confirmado||!lote.preview||lote.concluido)return
    setOcupado(true)
    try{
      const preview=await pedir(lote,'aplicar')
      alterar(lote.id,{preview,concluido:true,confirmado:false})
      toast.success(numero((preview.atualizados||0)+(preview.criados||0))+' cadastro(s) processados.')
      onImported()
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível aplicar a nota.')}
    finally{setOcupado(false)}
  }
  function escolher(lote:Lote,linha:number,value:string){
    const escolhas={...lote.escolhas}
    if(value==='')delete escolhas[linha]
    else if(value==='criar')escolhas[linha]={linha,acao:'criar'}
    else escolhas[linha]={linha,acao:'vincular',produtoId:value}
    alterar(lote.id,{escolhas,confirmado:false})
  }
  return <section className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-label="Importar XML de notas de compra">
    <div className="flex items-center gap-2">
      <FileCode2 className="size-5 text-primary"/>
      <h3 className="text-sm font-semibold">Importar notas de compra dos fornecedores (XML da NF-e)</h3>
    </div>
    <p className="text-xs text-muted-foreground">
      Importe XMLs autorizados de NF-e modelo 55 recebidos dos fornecedores. O sistema cruza GTIN/EAN
      com os produtos atuais, apresenta uma prévia e preenche NCM, CEST e GTIN apenas quando vazios.
      Sem correspondência, você pode vincular manualmente ou cadastrar um produto <strong>inativo</strong>.
      Não altera estoque, preços de venda nem regras tributárias de saída.
    </p>
    <div className="flex flex-wrap items-center gap-3">
      <input type="file" accept=".xml,text/xml,application/xml" multiple onChange={carregar} disabled={ocupado}
        aria-label="Selecionar XMLs de compra dos fornecedores"
        className="block max-w-full text-xs file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-xs"/>
      <Button type="button" size="sm" variant="outline" onClick={simular} disabled={ocupado||!lotes.length}>
        {ocupado?<Loader2 className="mr-2 size-4 animate-spin"/>:<Upload className="mr-2 size-4"/>}
        Analisar {lotes.length||''} XML(s)
      </Button>
    </div>
    {lotes.map(lote=><div key={lote.id} className="space-y-3 rounded-lg border bg-background p-3">
      <p className="text-sm font-semibold break-all">{lote.arquivo}</p>
      {!lote.preview?<p className="text-xs text-muted-foreground">Aguardando análise.</p>:<>
        <div className="text-xs">
          <p className="font-medium">NF-e {lote.preview.nota.numero} / série {lote.preview.nota.serie} · {lote.preview.nota.fornecedor}</p>
          <p className="text-muted-foreground break-all">Chave: {lote.preview.nota.chave}</p>
          <p>{lote.preview.nota.ambiente==='1'?'Produção':'Homologação'} · {lote.preview.nota.autorizada?'Autorizada':'Sem protocolo de autorização válido'}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{numero(lote.preview.totais.linhas)} itens</span>
          <span>{numero(lote.preview.totais.aptas)} aptos</span>
          <span>{numero(lote.preview.totais.semVinculo)} sem vínculo</span>
          <span>{numero(lote.preview.totais.jaPreenchidos)} já preenchidos</span>
          <span>{numero(lote.preview.totais.conflitos+lote.preview.totais.revisar+lote.preview.totais.duplicadas)} para revisão</span>
        </div>
        {(lote.preview.jaImportada||!lote.preview.nota.autorizada||lote.preview.nota.ambiente!=='1')&&
          <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0"/>
            {lote.preview.jaImportada?'Esta nota já possui importação registrada.':
              'Somente XML de NF-e autorizada em produção pode ser aplicado. Esta nota serve apenas para conferência.'}
          </p>}
        <div className="max-h-[26rem] overflow-auto rounded-md border">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="sticky top-0 bg-muted"><tr className="text-left">
              <th className="p-2">Item</th><th className="p-2">Classificação do XML</th>
              <th className="p-2">Conferência</th><th className="p-2">Vinculação</th>
            </tr></thead>
            <tbody>{lote.preview.linhas.map(linha=><tr key={linha.linha} className="border-t align-top">
              <td className="max-w-[240px] p-2"><strong>{linha.linha}. {linha.descricao}</strong>
                <p className="break-all text-muted-foreground">GTIN: {linha.gtin||'Não informado'}</p>
              </td>
              <td className="p-2">NCM: {linha.ncm||'—'}<p>CEST: {linha.cest||'—'}</p></td>
              <td className="max-w-[220px] p-2"><strong>{linha.status.replaceAll('_',' ')}</strong><p className="text-muted-foreground">{linha.motivo}</p></td>
              <td className="p-2">
                {linha.status==='sem_vinculo'&&!lote.concluido?<>
                  <input type="search" placeholder="Buscar produto cadastrado" aria-label={'Buscar produto da linha '+linha.linha}
                    className="mb-1 w-full rounded border bg-background px-2 py-1"
                    value={lote.buscas[linha.linha]||''} onChange={e=>alterar(lote.id,{
                      buscas:{...lote.buscas,[linha.linha]:e.target.value},confirmado:false,
                    })}/>
                  <select className="w-full max-w-[300px] rounded border bg-background p-1"
                    aria-label={'Vincular linha '+linha.linha}
                    value={lote.escolhas[linha.linha]?.acao==='criar'?'criar':lote.escolhas[linha.linha]?.produtoId||''}
                    onChange={e=>escolher(lote,linha.linha,e.target.value)}>
                    <option value="">Ignorar por enquanto</option>
                    <option value="criar">Cadastrar novo inativo (estoque 0)</option>
                    {lote.preview!.catalogo.filter(p=>{
                      const busca=(lote.buscas[linha.linha]||'').trim().toLowerCase()
                      return !busca||[p.nome,p.sku||'',p.gtinFiscal||''].some(v=>v.toLowerCase().includes(busca))
                    }).slice(0,40).map(p=><option key={p.id} value={p.id}>{p.nome} · {p.sku||p.gtinFiscal||'sem SKU'}</option>)}
                    {lote.escolhas[linha.linha]?.produtoId&&!lote.preview!.catalogo.slice(0,40).some(p=>p.id===lote.escolhas[linha.linha].produtoId)&&
                      <option value={lote.escolhas[linha.linha].produtoId!}>Produto selecionado</option>}
                  </select>
                </>:<span className="text-muted-foreground">{linha.produtoIds.length?linha.produtoIds.length+' cadastro(s)':'—'}</span>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0"/>
          {lote.preview.aviso} Confirme as informações do fornecedor antes de aprovar.
        </p>
        {lote.concluido?<p className="flex gap-2 text-sm text-green-700">
          <CheckCircle2 className="size-4"/> {numero(lote.preview.atualizados||0)} atualizado(s),
          {numero(lote.preview.criados||0)} novo(s) inativo(s).
        </p>:!lote.preview.jaImportada&&lote.preview.nota.autorizada&&lote.preview.nota.ambiente==='1'&&<>
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={lote.confirmado} onCheckedChange={v=>alterar(lote.id,{confirmado:v===true})}/>
            <span>Conferi a NF-e e autorizo a atualização somente de campos fiscais vazios e os cadastros novos inativos escolhidos.</span>
          </label>
          <Button type="button" size="sm" disabled={ocupado||!lote.confirmado}
            onClick={()=>aplicar(lote)}>{ocupado?<Loader2 className="mr-2 size-4 animate-spin"/>:null}
            Aplicar classificação desta NF-e
          </Button>
        </>}
      </>}
    </div>)}
  </section>
}
