'use client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FormAnswers,FormField,FormSection } from '@/lib/atendimento-ficha'

export type FichaResponse={
 id:string;petId:string;processoId:string
 checkin:unknown;checkinStatus:string;checkinSubmittedAt:string|null
 tutorAceiteAt:string|null;tutorAceiteNome:string|null;tutorAceiteVersao?:string|null;tutorAceiteHash?:string|null
 checkout:unknown;checkoutFinalizadoAt:string|null;createdAt:string
 processo?:{servico:string;createdAt:string;pet:{id:string;nome:string;raca:string|null}}|null
}
export const asAnswers=(value:unknown):FormAnswers=>value&&typeof value==='object'&&!Array.isArray(value)
 ? value as FormAnswers :{}
export const dateTime=(v:string|null|undefined)=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Não registrado'
function readAnswer(v:unknown){
 if(Array.isArray(v))return v.length?v.join(', '):'—'
 if(typeof v==='string')return v.trim()||'—'
 return '—'
}
function FieldEditor({field,value,onChange,disabled}:{field:FormField;value:unknown;onChange:(v:string|string[])=>void;disabled:boolean}){
 if(field.kind==='text')return <Textarea rows={2} maxLength={1500} className="text-sm min-h-16" value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder="Descreva, se aplicável..." />
 if(field.kind==='choice')return <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={typeof value==='string'?value:''} disabled={disabled} onChange={e=>onChange(e.target.value)}>
  <option value="">Selecione / não registrado</option>
  {field.options?.map(v=><option key={v} value={v}>{v}</option>)}
 </select>
 const selected=Array.isArray(value)?value as string[]:[]
 return <div className="flex flex-wrap gap-x-4 gap-y-2">
  {field.options?.map(option=><label key={option} className="flex items-center gap-1.5 text-xs">
   <input type="checkbox" className="size-4 accent-primary" checked={selected.includes(option)} disabled={disabled}
    onChange={e=>onChange(e.target.checked?[...selected,option]:selected.filter(x=>x!==option))} />{option}
  </label>)}
 </div>
}
export function FichaSections({sections,answers,onChange,readonly=false,initialOpen=false}:{
 sections:FormSection[];answers:FormAnswers;onChange?:(value:FormAnswers)=>void;readonly?:boolean;initialOpen?:boolean
}){
 return <div className="space-y-3">
  {sections.map((section,index)=><details key={section.id} open={readonly?true:undefined} defaultOpen={!readonly&&initialOpen&&index===0} className="rounded-lg border bg-card p-3 print:break-inside-auto print:border-0 print:p-0">
   {!readonly?<summary className="cursor-pointer text-sm font-semibold">{section.title}</summary>:<h3 className="mb-2 mt-4 text-sm font-bold border-b pb-1 print:text-black">{section.title}</h3>}
   {section.description&&<p className="mt-2 text-xs text-muted-foreground print:text-black">{section.description}</p>}
   <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
    {section.fields.map(field=><div className={field.kind==='multi'||field.kind==='text'?'sm:col-span-2':''} key={field.id}>
      <p className="mb-1 text-xs font-medium print:text-black">{field.label}</p>
      {readonly?<p className="min-h-5 border-b border-dotted py-0.5 text-xs print:text-black">{readAnswer(answers[field.id])}</p>:
      <FieldEditor field={field} value={answers[field.id]} disabled={!onChange}
       onChange={value=>onChange?.({...answers,[field.id]:value})}/>}
    </div>)}
   </div>
  </details>)}
 </div>
}
