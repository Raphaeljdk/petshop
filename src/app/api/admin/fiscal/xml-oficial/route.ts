import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, assertSameOrigin, readAuthBody } from '@/lib/auth-http'
import { gerarRascunhoNfe55, NfeRascunhoError } from '@/lib/nfe-xml-modelo55'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const fail = (error: string, status: number) => NextResponse.json({error},{status,headers})
const endereco = z.object({
  logradouro:z.string().trim().min(2).max(60),
  numero:z.string().trim().min(1).max(60),
  bairro:z.string().trim().min(2).max(60),
  municipio:z.string().trim().min(2).max(60),
  codigoMunicipio:z.string().regex(/^\d{7}$/),
  uf:z.string().regex(/^[A-Z]{2}$/),
  cep:z.string().regex(/^\d{8}$/),
}).strict()
const schema = z.object({
  vendaId:z.string().min(1).max(80),
  numero:z.number().int().min(1).max(999999999),
  codigoNumerico:z.string().regex(/^\d{8}$/),
  naturezaOperacao:z.string().trim().min(3).max(60),
  destinatario:z.object({
    nome:z.string().trim().min(2).max(60),
    documento:z.string().regex(/^\d{11}(\d{3})?$/),
    endereco,
  }).strict(),
  pagamento:z.enum(['01','17','18']),
  modalidadeFrete:z.enum(['0','1','2','9']),
  itens:z.array(z.object({
    produtoId:z.string().min(1).max(100),
    pisCst:z.enum(['04','05','06','07','08','09']),
    cofinsCst:z.enum(['04','05','06','07','08','09']),
  }).strict()).min(1).max(990),
}).strict()

async function permissao() {
  const user = await getUsuarioLogado()
  return user ? (user.role==='ADMIN' ? null : fail('Acesso restrito ao administrador.',403)) : fail('Não autenticado.',401)
}
async function carregarVenda(id: string) {
  return db.venda.findUnique({
    where:{id},
    select:{
      id:true,canal:true,status:true,total:true,valorFrete:true,descontoCupom:true,subtotalProdutos:true,
      marketplaceBuyerName:true,marketplaceBuyerDocument:true,enderecoEntrega:true,cepEntrega:true,
      cliente:{select:{nome:true,cpfCnpj:true,endereco:true,cep:true}},
      notaFiscal:{select:{status:true,chaveAcesso:true,numero:true,emissorDocumentoId:true}},
      itens:{orderBy:{id:'asc'},select:{
        produtoId:true,quantidade:true,precoUnit:true,
        produto:{select:{nome:true,sku:true,ncm:true,cest:true,cfop:true,origem:true,csosn:true,unidadeFiscal:true}},
      }},
    },
  })
}
function podeMontar(venda: Awaited<ReturnType<typeof carregarVenda>>) {
  if (!venda) return 'Venda não encontrada.'
  if (!['site','amazon'].includes(venda.canal)) return 'Apenas vendas do site/Amazon; Mercado Livre usa Faturador próprio.'
  if (venda.status!=='concluida') return 'É necessário concluir a venda.'
  if (venda.notaFiscal && (venda.notaFiscal.status!=='rascunho'
    || venda.notaFiscal.chaveAcesso || venda.notaFiscal.numero || venda.notaFiscal.emissorDocumentoId))
    return 'Esta venda já possui emissão fiscal em andamento ou registrada. Não gerar outra nota.'
  return null
}
export async function GET(req:NextRequest) {
  const denied = await permissao(); if (denied) return denied
  const id = req.nextUrl.searchParams.get('vendaId') || ''
  if (!id || id.length > 80) return fail('Identifique a venda.',400)
  const [venda,empresa] = await Promise.all([
    carregarVenda(id),
    db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{serieNfe:true}}),
  ])
  const erro=podeMontar(venda); if (erro) return fail(erro,venda?409:404)
  return NextResponse.json({
    serie:empresa?.serieNfe??1,
    nome:venda?.marketplaceBuyerName || venda?.cliente?.nome || '',
    documento:venda?.marketplaceBuyerDocument || venda?.cliente?.cpfCnpj || '',
    enderecoTexto:venda?.enderecoEntrega || venda?.cliente?.endereco || '',
    cep:venda?.cepEntrega || venda?.cliente?.cep || '',
    itens:venda?.itens.map(i=>({
      produtoId:i.produtoId,nome:i.produto.nome,quantidade:i.quantidade,
      ncm:i.produto.ncm,cfop:i.produto.cfop,csosn:i.produto.csosn,
    })),
    aviso:'Dados fiscais devem ser conferidos pelo contador. Somente rascunho em homologação; não gera nota autorizada.',
  },{headers})
}
export async function POST(req:NextRequest) {
  const denied=await permissao(); if (denied) return denied
  try {
    assertSameOrigin(req)
    const parsed=schema.safeParse(await readAuthBody(req))
    if (!parsed.success) return fail('Dados obrigatórios incompletos ou inválidos. Confira número, códigos, endereço, pagamento e itens.',400)
    const input=parsed.data
    const [venda,empresa] = await Promise.all([
      carregarVenda(input.vendaId),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'}}),
    ])
    const bloqueio=podeMontar(venda); if (bloqueio) return fail(bloqueio,venda?409:404)
    if (!empresa || !venda) return fail('Cadastre primeiro o emitente e confirme a venda.',409)
    const {xml}=gerarRascunhoNfe55(venda,empresa,input)
    const safeId=venda.id.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80) || 'venda'
    return new NextResponse(xml,{headers:{
      ...headers,'Content-Type':'application/xml; charset=utf-8',
      'Content-Disposition':'attachment; filename="RASCUNHO-NFE55-HOMOLOGACAO-' + safeId + '.xml"',
    }})
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message,error.status)
    if (error instanceof NfeRascunhoError) return fail(error.message,409)
    console.error('Falha ao montar rascunho NF-e 55 (sem transmissão).')
    return fail('Não foi possível montar o rascunho da NF-e.',500)
  }
}
