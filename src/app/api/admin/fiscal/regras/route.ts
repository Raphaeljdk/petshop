import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, assertSameOrigin, readAuthBody } from '@/lib/auth-http'
import { validarCamposFiscaisSimples } from '@/lib/fiscal-simples-produto'
import { escopoConsultaCompleto, selecionarRegraFiscal } from '@/lib/fiscal-consulta-automatica'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={ 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' }
const resposta=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
async function autorizar(){
  const u=await getUsuarioLogado()
  if(!u)return resposta({error:'Não autenticado.'},401)
  if(u.role!=='ADMIN')return resposta({error:'Apenas o administrador pode consultar regras fiscais.'},403)
  return null
}
const taxas=['aliquotaIcmsSt','aliquotaPis','aliquotaCofins','aliquotaIpi',
  'aliquotaFcpSt','aliquotaIbsUf','aliquotaIbsMun','aliquotaCbs'] as const
const percent=z.number().finite().min(0).max(100).nullish()
const schema=z.object({
  ncm:z.string().regex(/^\d{8}$/), cfop:z.string().regex(/^5\d{3}$/),
  ufDestino:z.literal('SP'), origem:z.string().regex(/^[0-8]$/),
  indicadorIE:z.literal('9'),
  csosn:z.string().min(3).max(3), cest:z.string().max(7).nullish(),
  pisCst:z.string().min(2).max(2), cofinsCst:z.string().min(2).max(2),
  ipiCst:z.string().max(2).nullish(),
  ibsCbsCst:z.string().max(3).nullish(),
  ibsCbsClassTrib:z.string().max(6).nullish(),
  aliquotaIcmsSt:percent, aliquotaPis:percent, aliquotaCofins:percent,
  aliquotaIpi:percent, aliquotaFcpSt:percent,
  aliquotaIbsUf:percent, aliquotaIbsMun:percent, aliquotaCbs:percent,
  contadorResponsavel:z.string().trim().min(3).max(120),
  referencia:z.string().trim().min(6).max(500),
  observacoes:z.string().max(1000).nullish(),
  confirmacao:z.literal('REVISADO_COM_CONTADOR'),
}).strict()

/**
 * Consulta AUTOMÁTICA apenas à base de regras cadastradas/revisadas.
 * Não é consulta pública de alíquotas da Receita e nunca ativa emissão.
 */
export async function GET(req:NextRequest) {
  const denied=await autorizar();if(denied)return denied
  const q=req.nextUrl.searchParams
  const input={
    ncm:(q.get('ncm')||'').replace(/\D/g,''),
    cfop:(q.get('cfop')||'').replace(/\D/g,''),
    origem:q.get('origem')||'',
    ufDestino:q.get('ufDestino')||'SP',
    indicadorIE:q.get('indicadorIE')||'9',
  }
  if(!escopoConsultaCompleto(input)){
    return resposta({status:'escopo_incompleto',regra:null,
      mensagem:'Informe NCM de 8 dígitos, CFOP de venda interna (5xxx), origem (0–8) e confirme SP, consumidor final não contribuinte. Para outros cenários é necessária regra própria.'})
  }
  try{
    const empresa=await db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{regimeTributario:true}})
    if(empresa?.regimeTributario!=='1')return resposta({status:'bloqueado',regra:null,
      mensagem:'A consulta automática exige o emitente configurado com CRT 1 — Simples Nacional.'},409)
    const candidatas=await db.regraFiscalAprovada.findMany({
      where:{ncm:input.ncm,ufDestino:input.ufDestino,cfop:input.cfop,origem:input.origem,
        indicadorIE:input.indicadorIE,ativo:true},
      take:3,
    })
    const escolhida=selecionarRegraFiscal(candidatas,input)
    const regra=escolhida.regra
    return resposta({
      status:escolhida.status,
      regra:regra?{
        id:regra.id,ncm:regra.ncm,cfop:regra.cfop,ufDestino:regra.ufDestino,
        origem:regra.origem,indicadorIE:regra.indicadorIE,csosn:regra.csosn,
        cest:regra.cest,pisCst:regra.pisCst,cofinsCst:regra.cofinsCst,
        ipiCst:regra.ipiCst,ibsCbsCst:regra.ibsCbsCst,
        ibsCbsClassTrib:regra.ibsCbsClassTrib,
        aliquotaIcmsSt:regra.aliquotaIcmsSt,aliquotaPis:regra.aliquotaPis,
        aliquotaCofins:regra.aliquotaCofins,aliquotaIpi:regra.aliquotaIpi,
        aliquotaFcpSt:regra.aliquotaFcpSt,aliquotaIbsUf:regra.aliquotaIbsUf,
        aliquotaIbsMun:regra.aliquotaIbsMun,aliquotaCbs:regra.aliquotaCbs,
        contadorResponsavel:regra.contadorResponsavel,referencia:regra.referencia,
        aprovadoEm:regra.aprovadoEm,observacoes:regra.observacoes,
      }:null,
      mensagem:regra?'Encontrada uma regra de referência revisada para este NCM, CFOP, origem e operação interna SP. Verifique antes de aplicar; alíquotas não são cálculos de impostos da NF-e.':
        escolhida.status==='ambigua'?'Foram encontradas regras conflitantes. Consulte a contabilidade.':
        'Nenhuma regra revisada encontrada para a operação. Preencha a classificação com o contador e cadastre a regra de referência abaixo. Nenhuma alíquota será presumida.',
    })
  }catch(e){
    console.error('Consulta fiscal automática indisponível',e)
    return resposta({error:'Falha ao consultar regras fiscais. Verifique a migração do banco.'},500)
  }
}

/**
 * Criação somente após declaração explícita da conferência contábil.
 * Regra não cria NF-e nem grava imposto numa venda.
 */
export async function POST(req:NextRequest){
  const denied=await autorizar();if(denied)return denied
  try{
    assertSameOrigin(req)
    const parsed=schema.safeParse(await readAuthBody(req))
    if(!parsed.success)return resposta({error:'Dados inválidos. Informe a operação SP, todos os códigos obrigatórios, contador e referência da revisão.'},400)
    const d=parsed.data
    const invalidos=validarCamposFiscaisSimples(d)
    if(invalidos.length)return resposta({error:invalidos.join(' ')},400)
    if(d.csosn==='500' && d.aliquotaIcmsSt==null && d.aliquotaFcpSt==null){
      // CSOSN 500 pode representar imposto retido anteriormente. Não inventar percentuais.
    }
    const empresa=await db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{regimeTributario:true}})
    if(empresa?.regimeTributario!=='1')return resposta({error:'Configure CRT 1 antes de cadastrar uma regra do Simples.'},409)
    const key={ncm:d.ncm,cfop:d.cfop,ufDestino:d.ufDestino,origem:d.origem,indicadorIE:d.indicadorIE}
    const existent=await db.regraFiscalAprovada.findUnique({where:{
      ncm_cfop_ufDestino_origem_indicadorIE:key,
    },select:{id:true}})
    if(existent)return resposta({error:'Já existe regra cadastrada para este NCM, CFOP, origem e operação. Não é seguro sobrescrevê-la sem histórico de revisão.'},409)
    const {confirmacao:_,...payload}=d
    const regra=await db.regraFiscalAprovada.create({data:{
      ...payload,
      cest:payload.cest||null,ipiCst:payload.ipiCst||null,
      ibsCbsCst:payload.ibsCbsCst||null,
      ibsCbsClassTrib:payload.ibsCbsClassTrib||null,
      observacoes:payload.observacoes||null,
    }})
    return resposta({id:regra.id,status:'registrada',
      mensagem:'Regra de referência cadastrada. Aplicação nos produtos exige confirmação; a emissão de NF-e segue bloqueada.'},201)
  }catch(e){
    if(e instanceof AuthError)return resposta({error:e.message},e.status)
    console.error('Falha ao salvar regra fiscal')
    return resposta({error:'Não foi possível registrar a regra. Confira se ela já existe ou se o banco foi migrado.'},500)
  }
}
