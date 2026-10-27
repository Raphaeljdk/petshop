import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { auditarCatalogoSaida } from '@/lib/fiscal-auditoria-saida'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/**
 * Auditoria somente leitura e reservada ao ADMIN.
 * O status 107 da SEFAZ e os códigos cadastrados não equivalem à
 * autorização de NF-e ou à aprovação da tributação pelo contador.
 */
export async function GET(){
  const usuario=await getUsuarioLogado()
  if(!usuario)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(usuario.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403})
  try{
    const [produtos,regras]=await Promise.all([
      db.produto.findMany({select:{
        id:true,nome:true,sku:true,ncm:true,cfop:true,csosn:true,
        pisCst:true,cofinsCst:true,
      }}),
      db.regraFiscalAprovada.count({where:{ativo:true}}),
    ])
    const auditoria=auditarCatalogoSaida(produtos)
    return NextResponse.json({
      resumo:{
        ...auditoria,alertas:undefined,regrasRevisadasAtivas:regras,
        emissorProprioAutorizado:false,
      },
      alertas:auditoria.alertas.filter(a=>
        a.severidade==='bloqueio'||a.severidade==='revisao').slice(0,80),
      aviso:'Auditoria de consistência documental: não aprova CFOP/CSOSN/PIS/COFINS para uma venda. CST 49 válido requer grupo PISOutr/COFINSOutr que não existe no rascunho atual. Sem XSD, assinatura XMLDSig e autorização de homologação não há emissão própria.',
    },{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){
    console.error('Erro na auditoria fiscal de saída',e)
    return NextResponse.json({error:'Não foi possível auditar os códigos fiscais.'},{status:500})
  }
}
