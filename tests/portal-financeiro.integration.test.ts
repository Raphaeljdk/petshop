/// <reference types="bun-types" />
import { beforeAll,afterAll,expect,test } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import type { Subprocess } from 'bun'

if(!/postgresql:\/\/[^/]+\/matilha_auth_test\b/.test(process.env.DATABASE_URL||''))
  throw new Error('Utilize apenas o banco isolado matilha_auth_test.')
const db=new PrismaClient()
const base='http://localhost:3103'
const prefix='portal-'+randomBytes(5).toString('hex')
const password='Matilha9-'+randomBytes(10).toString('hex')
let server:Subprocess
let a='',b='',petId=''
function email(s:string){return prefix+'-'+s+'@example.test'}
function cpfFor(name:string) {
  const baseDigits=Array.from((name+prefix).split('').map(x=>x.charCodeAt(0)%10).join('').padEnd(9,'2').slice(0,9)).map(Number)
  const digit=(size:number)=>{
    let sum=0
    for(let i=0;i<size;i++)sum+=(baseDigits[i]||0)*(size+1-i)
    const value=(sum*10)%11
    return value===10?0:value
  }
  baseDigits.push(digit(9));baseDigits.push(digit(10))
  return baseDigits.join('')
}
async function post(path:string,data:unknown,cookie?:string){
  return fetch(base+path,{method:'POST',headers:{
    'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})
  },body:JSON.stringify(data)})
}
async function register(name:string){
  const response=await post('/api/auth/register',{
    nome:'Tutor '+name,email:email(name),cpfCnpj:cpfFor(name),telefone:name==='a'?'11911111111':'11922222222',
    senha:password,confirmarSenha:password,role:'CLIENTE',
  })
  expect(response.status).toBe(201)
  return response.headers.get('set-cookie')!.split(';')[0]
}
beforeAll(async()=>{
  server=Bun.spawn(['bun',resolve('.next/standalone/server.js')],{
    env:{...process.env,PORT:'3103',HOSTNAME:'127.0.0.1',NODE_ENV:'production'},
    stdout:'ignore',stderr:'inherit',
  })
  for(let n=0;n<100;n++){
    try{if((await fetch(base+'/api/auth/me')).ok)break}catch{}
    if(n===99)throw Error('Servidor não iniciou.')
    await Bun.sleep(200)
  }
  a=await register('a');b=await register('b')
  const r=await post('/api/cliente/pets',{nome:'Estrela',especie:'cachorro'},a)
  expect(r.status).toBe(201)
  petId=(await r.json()).id
},45000)
afterAll(async()=>{server?.kill();await db.$disconnect()})
test('PDF não revela o arquivo do tutor A para o tutor B',async()=>{
  const fileData=Buffer.from('%PDF-1.4\n'+'A'.repeat(150)+'\n%%EOF\n').toString('base64')
  const uploaded=await post('/api/cliente/portal/documentos',{
    petKey:petId,title:'Comprovante do tutor',fileName:'carteirinha.pdf',fileData,
  },a)
  expect(uploaded.status).toBe(201)
  const {id}=await uploaded.json()
  const own=await fetch(base+'/api/cliente/portal/documentos/'+id,{headers:{Cookie:a}})
  expect(own.status).toBe(200)
  expect(own.headers.get('content-disposition')).toContain('attachment')
  expect(own.headers.get('cache-control')).toContain('no-store')
  const other=await fetch(base+'/api/cliente/portal/documentos/'+id,{headers:{Cookie:b}})
  expect(other.status).toBe(404)
  const deleted=await fetch(base+'/api/cliente/portal/documentos/'+id,{
    method:'DELETE',headers:{Cookie:b,Origin:base},
  })
  expect((await deleted.json()).success).toBe(false)
  const still=await fetch(base+'/api/cliente/portal/documentos/'+id,{headers:{Cookie:a}})
  expect(still.status).toBe(200)
})
test('vale-presente com destinatário é restrito ao e-mail autenticado',async()=>{
  const code='MP-PRES-'+randomBytes(7).toString('hex').toUpperCase()
  await db.portalGiftRequest.create({data:{
    clienteId:(await db.cliente.findUniqueOrThrow({where:{email:email('a')}})).id,
    recipientName:'Tutor A',recipientEmail:email('a'),amountCents:5000,
    balanceCents:5000,paidAt:new Date(),status:'pago',voucherCode:code,
  }})
  const unauthorized=await post('/api/cliente/portal/vale-validar',{code,totalCents:3500},b)
  expect(unauthorized.status).toBe(403)
  const valid=await post('/api/cliente/portal/vale-validar',{code,totalCents:3500},a)
  expect(valid.status).toBe(200)
  const json=await valid.json()
  expect(json.appliedCents).toBe(3500)
})
test('sem credenciais não simula cobrança recorrente e webhook não aceita assinatura ausente',async()=>{
  const client=await db.cliente.findUniqueOrThrow({where:{email:email('a')}})
  const pet=await db.pet.findFirstOrThrow({where:{clienteId:client.id}})
  const plan=await db.portalCarePlan.create({data:{
    title:'Banhos de teste',description:'Plano isolado de homologação',
    sessions:4,durationDays:30,priceCents:12000,active:true,
  }})
  const request=await db.portalCarePlanRequest.create({data:{
    clienteId:client.id,planId:plan.id,petKey:pet.id,
  }})
  const checkout=await post('/api/cliente/portal/assinaturas',{action:'start',requestId:request.id},a)
  expect(checkout.status).toBe(503)
  const webhook=await post('/api/pagamento/assinaturas/webhook',{
    type:'subscription_authorized_payment',data:{id:'123456'},
  })
  expect(webhook.status).toBe(503)
})
test('cron exige segredo e portal não libera páginas privadas sem sessão',async()=>{
  const cron=await fetch(base+'/api/cron/portal-notificacoes')
  expect(cron.status).toBe(401)
  const portal=await fetch(base+'/api/cliente/portal')
  expect(portal.status).toBe(401)
})
