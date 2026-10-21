import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { amazonSpApiConfigState } from '@/lib/amazon-sp-api'

export const dynamic='force-dynamic'
export async function GET(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
  const state=amazonSpApiConfigState()
  return NextResponse.json({
    apiConfigurada:state.configured,
    configuracaoPendente:state.missing,
    permissaoTaxInvoicing:'nao_verificada',
    consultaFbaDisponivel:'exige_consulta_de_teste',
    emissaoNfeDisponivel:false,
    aviso:state.configured
      ? 'Amazon SP-API configurada para conexão. Isso não comprova Tax Invoicing nem permite emitir NF-e. Teste Consultar notas FBA para validar a permissão.'
      : 'Configuração de SP-API Amazon incompleta. Não é possível consultar notas FBA ainda.',
  },{headers:{'Cache-Control':'no-store'}})
}
