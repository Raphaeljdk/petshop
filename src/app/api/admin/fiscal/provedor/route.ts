import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { db } from '@/lib/db'
import { SEFAZ_SP, lerA1DeVariaveis, consultarStatusHomologacaoSefazSp } from '@/lib/sefaz-sp-nfe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function authorize() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })
  return null
}
function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
async function company() {
  return db.configuracaoFiscal.findUnique({
    where: { id: 'matilha-prado' },
    select: { cnpj: true, uf: true, codigoMunicipio: true, serieNfe: true, ambiente: true },
  })
}

/** Diagnóstico seguro: mostra requisitos, não expõe arquivo PFX nem senha. */
export async function GET() {
  const denied = await authorize(); if (denied) return denied
  const emitente = await company()
  return noStore({
    provedor: 'SEFAZ-SP (direto)',
    uf: 'SP',
    ambienteDeTeste: 'homologacao',
    certificadoConfigurado: !!(process.env.SEFAZ_NFE_A1_PFX_BASE64?.trim() && process.env.SEFAZ_NFE_A1_SENHA),
    emitenteSp: emitente?.uf?.toUpperCase() === 'SP',
    municipioConfigurado: !!emitente?.codigoMunicipio,
    enderecoServico: SEFAZ_SP.homologacao.status,
    emissaoRealHabilitada: false,
    aviso: 'Emissor próprio em implantação. Somente o teste de comunicação com a SEFAZ-SP em HOMOLOGAÇÃO está disponível. Nenhum XML de nota é enviado.',
  })
}

/**
 * Testa certificado e SOAP NFeStatusServico4 da SEFAZ-SP em tpAmb=2.
 * Nunca utiliza as credenciais em produção, mesmo que o emitente tenha ambiente=producao.
 */
export async function POST(req: NextRequest) {
  const denied = await authorize(); if (denied) return denied
  try {
    assertSameOrigin(req)
    const emitente = await company()
    if (!emitente?.cnpj || !/^\d{14}$/.test(emitente.cnpj.replace(/\D/g, '')) ||
      emitente.uf?.toUpperCase() !== 'SP') {
      return noStore({error: 'Cadastre o CNPJ do emitente e UF SP em Dados do emitente.'}, 409)
    }
    const credentials = lerA1DeVariaveis(process.env)
    try {
      const resultado = await consultarStatusHomologacaoSefazSp(credentials)
      return noStore({
        ok: resultado.disponivel,
        certificadoAberto: true,
        ambiente: 'homologacao',
        codigo: resultado.codigo,
        motivo: resultado.motivo,
        emissaoRealHabilitada: false,
        aviso: resultado.disponivel
          ? 'A1 aceito pela comunicação TLS e serviço de HOMOLOGAÇÃO ativo. Nenhuma NF-e emitida. A validade fiscal e o vínculo do CNPJ com o A1 ainda exigem conferência.'
          : 'A1 aberto, porém a SEFAZ não retornou status operacional 107. Nenhuma nota foi enviada.',
      })
    } catch {
      return noStore({
        error: 'O A1 foi aberto localmente, mas não foi possível consultar o serviço de homologação da SEFAZ-SP. Confira credenciamento, validade, rede e certificado.',
      }, 502)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha de configuração.'
    if (message.includes('A1') || message.includes('PFX') || message.includes('SEFAZ_NFE_A1'))
      return noStore({error: message}, 409)
    return noStore({error: 'Falha de configuração de homologação. Nenhuma nota emitida.'}, 500)
  }
}
