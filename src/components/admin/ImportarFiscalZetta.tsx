'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

type Preview = {
 hash:string;arquivo:string;
 totais:{linhas:number;aptas:number;semVinculo:number;conflitos:number;revisar:number;duplicadas:number;semDados:number;produtosAlvo:number}
 linhas:Array<{linha:number;status:string;motivo:string;sku:string;descricao:string;registros:number;campos:string[]}>
 aviso:string;aplicados?:number;naoAplicados?:number
}
const format=(x:number|undefined)=>Number(x||0).toLocaleString('pt-BR')

export function ImportarFiscalZetta({onImported}:{onImported:()=>void}){
  const [arquivo,setArquivo]=useState('')
  const [texto,setTexto]=useState('')
  const [preview,setPreview]=useState<Preview|null>(null)
  const [confirmado,setConfirmado]=useState(false)
  const [working,setWorking]=useState(false)
  async function carregar(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];setPreview(null);setConfirmado(false)
    if(!file){setArquivo('');setTexto('');return}
    if(!file.name.toLowerCase().endsWith('.csv')||file.size>600_000){
      toast.error('Exporte CSV UTF-8 de até 600 KB. Arquivos Excel devem ser salvos em CSV.');return
    }
    setArquivo(file.name);setTexto(await file.text())
  }
  async function consultar(modo:'simular'|'aplicar'){
    if(!arquivo||!texto)return toast.error('Selecione o arquivo CSV exportado do Zetta.')
    if(modo==='aplicar'&&(!preview||!confirmado))return toast.error('Confira a prévia e confirme antes de importar.')
    setWorking(true)
    try{
      const res=await fetch('/api/admin/fiscal/importar-zetta',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({csv:texto,arquivo,modo,hash:preview?.hash,
          confirmacao:modo==='aplicar'?'CONFIRMO_IMPORTACAO_FISCAL':undefined}),
      })
      const data=await res.json()
      if(!res.ok)throw Error(data.error||'Erro ao analisar a exportação.')
      setPreview(data)
      if(modo==='aplicar'){
        toast.success(format(data.aplicados)+' produtos atualizados sem sobrescrever classificações.')
        setConfirmado(false);onImported()
      }
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível analisar o arquivo.')}
    finally{setWorking(false)}
  }
  return <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-4">
    <div className="flex flex-wrap items-center gap-2">
      <FileSpreadsheet className="size-5 text-primary"/>
      <h3 className="text-sm font-semibold">Importar classificação fiscal do Zetta</h3>
    </div>
    <p className="text-xs text-muted-foreground">
      Exporte um CSV UTF-8 com NCM e GTIN/EAN ou pro_cod do Zetta. É uma importação
      independente; não reativa a sincronização de estoque e preços.
      O sistema cruza os identificadores, gera prévia e só altera NCM, CEST, GTIN e origem que estejam vazios.
    </p>
    <div className="flex flex-wrap items-center gap-2">
      <input type="file" accept=".csv,text/csv" onChange={carregar}
        aria-label="Escolher CSV fiscal exportado do Zetta" className="block max-w-full text-xs file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-xs"/>
      <Button type="button" variant="outline" size="sm" disabled={working||!texto} onClick={()=>consultar('simular')}>
        {working?<Loader2 className="mr-1 size-4 animate-spin"/>:<Upload className="mr-1 size-4"/>}
        Conferir antes de importar
      </Button>
    </div>
    <p className="text-xs">
      <a className="underline" target="_blank" rel="noopener noreferrer"
        href="https://github.com/Raphaeljdk/petshop/blob/main/docs/modelo-importacao-fiscal-zetta.csv">Ver modelo de colunas CSV</a>
      {' · '}Mantenha GTIN e pro_cod como texto para preservar zeros à esquerda.
    </p>
    {preview&&<div className="space-y-3 rounded-lg border bg-background p-3">
      <p className="font-medium text-sm">Prévia de {preview.arquivo}</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <p>Linhas: <strong>{format(preview.totais.linhas)}</strong></p>
        <p>Prontas para importar: <strong>{format(preview.totais.aptas)}</strong></p>
        <p>Produtos que podem receber campos: <strong>{format(preview.totais.produtosAlvo)}</strong></p>
        <p>Sem correspondência: <strong>{format(preview.totais.semVinculo)}</strong></p>
        <p>Conflitos: <strong>{format(preview.totais.conflitos)}</strong></p>
        <p>Revisão de dados: <strong>{format(preview.totais.revisar)}</strong></p>
        <p>Duplicados: <strong>{format(preview.totais.duplicadas)}</strong></p>
        <p>Já preenchidos/sem dados: <strong>{format(preview.totais.semDados)}</strong></p>
      </div>
      {typeof preview.aplicados==='number'&&preview.aplicados>0&&<p className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="size-4"/>{format(preview.aplicados)} produto(s) atualizados e auditados
      </p>}
      {preview.linhas.length>0&&<details className="text-xs">
        <summary className="cursor-pointer font-medium">Ver exemplos das linhas analisadas (até 100)</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="min-w-full border-collapse text-xs"><thead><tr className="border-b text-left">
            <th className="p-1">Linha</th><th className="p-1">SKU/GTIN</th><th className="p-1">Status</th><th className="p-1">Detalhes</th>
          </tr></thead><tbody>{preview.linhas.map(r=><tr key={r.linha} className="border-b">
            <td className="p-1">{r.linha}</td><td className="p-1 font-mono">{r.sku}</td>
            <td className="p-1">{r.status}</td><td className="p-1">{r.motivo}</td>
          </tr>)}</tbody></table>
        </div>
      </details>}
      <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-4 shrink-0"/>
        {preview.aviso} Códigos da nota de compra não equivalem aos impostos da venda no Simples Nacional.
      </p>
      {preview.totais.aptas>0&&typeof preview.aplicados!=='number'&&<>
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <Checkbox checked={confirmado} onCheckedChange={value=>setConfirmado(value===true)}/>
          <span>Conferi as fontes e autorizo preencher somente dados documentais vazios. Sei que não será habilitada a emissão de NF-e.</span>
        </label>
        <Button type="button" size="sm" disabled={!confirmado||working||preview.totais.produtosAlvo>450}
          onClick={()=>consultar('aplicar')}>
          {working?<Loader2 className="mr-1 size-4 animate-spin"/>:null}Importar {format(preview.totais.produtosAlvo)} produto(s)
        </Button>
        {preview.totais.produtosAlvo>450&&<p className="text-xs text-amber-700">Divida o CSV em lotes de até 450 produtos.</p>}
      </>}
    </div>}
  </div>
}
