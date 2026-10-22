import { NextRequest, NextResponse } from 'next/server'
import { configSchema, erroConfigEmitente } from '@/lib/fiscal-emitente'
import { avaliarProntidaoNfeProducao } from '@/lib/fiscal-prontidao-producao'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'

export const dynamic = 'force-dynamic'

async function authorize() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso exclusivo da administração.' }, { status: 403 })
  return null
}


export async function GET() {
  const denied = await authorize()
  if (denied) return denied
  try {
    const [config, notas, vendas, produtosAtivos, produtosSemClassificacao] = await Promise.all([
      db.configuracaoFiscal.findUnique({ where: { id: 'matilha-prado' } }),
      db.notaFiscal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 150,
        select: {
          id: true, vendaId: true, modelo: true, status: true, numero: true,
          serie: true, chaveAcesso: true, protocolo: true, danfeUrl: true,
          emissor: true, emissorDocumentoId: true, emissaoSolicitadaEm: true, consultadaEm: true,
          erro: true, autorizadaEm: true, canceladaEm: true, createdAt: true,
        },
      }),
      db.venda.findMany({
        orderBy: { createdAt: 'desc' }, take: 150,
        select: {
          id: true, total: true, canal: true, status: true,
          marketplaceOrderId: true, marketplaceBuyerName: true, mercadoPagoStatus: true,
          createdAt: true,
          cliente: { select: { nome: true, cpfCnpj: true } },
          notaFiscal: { select: { id: true, status: true, numero: true, chaveAcesso: true, emissor: true } },
        },
      }),
      db.produto.count({where:{ativo:true}}),
      db.produto.count({where:{ativo:true, OR:[
        {ncm:null},{ncm:''},{cfop:null},{cfop:''},
        {unidadeFiscal:null},{unidadeFiscal:''},
        {csosn:null},{csosn:''},{pisCst:null},{pisCst:''},{cofinsCst:null},{cofinsCst:''},{gtinFiscal:null},{gtinFiscal:''},
      ]}}),
    ])
    const prontidaoNfeProducao = avaliarProntidaoNfeProducao({
      empresa:config,
      certificadoRegistrado:!!(process.env.SEFAZ_NFE_A1_PFX_BASE64?.trim() && process.env.SEFAZ_NFE_A1_SENHA),
      produtosAtivos,produtosSemClassificacao,
    })
    return NextResponse.json({
      config, notas, vendas, prontidaoNfeProducao,
      emissaoConfigurada: false,
      emissaoMercadoLivreHabilitada: process.env.MERCADO_LIVRE_NFE_EMISSAO_HABILITADA === 'true',
      emissaoAviso: 'Consulta de notas pelo Faturador Mercado Livre disponível. Solicitações reais exigem liberação operacional específica. Site e Amazon seguem aguardando provedor de emissão.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('fiscal GET', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados fiscais.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const denied = await authorize()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const body = configSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: erroConfigEmitente(body.error) }, { status: 400 })
    const data = body.data
    const cnpj = data.cnpj?.replace(/\D/g, '') || null
    const cep = data.cep?.replace(/\D/g, '') || null
    const uf = data.uf?.trim().toUpperCase() || null
    const municipio = data.codigoMunicipio?.replace(/\D/g, '') || null
    if (cnpj && cnpj.length !== 14) return NextResponse.json({ error: 'CNPJ deve ter 14 dígitos.' }, { status: 400 })
    if (cep && cep.length !== 8) return NextResponse.json({ error: 'CEP deve ter 8 dígitos.' }, { status: 400 })
    if (uf && !/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ error: 'UF deve ter duas letras.' }, { status: 400 })
    if (municipio && municipio.length !== 7) return NextResponse.json({ error: 'Código IBGE do município deve ter 7 dígitos.' }, { status: 400 })
    const payload = {
      ...data, cnpj, cep, uf, codigoMunicipio: municipio,
      inscricaoEstadual: data.inscricaoEstadual?.trim() || null,
    }
    const config = await db.configuracaoFiscal.upsert({
      where: { id: 'matilha-prado' }, create: { id: 'matilha-prado', ...payload }, update: payload,
    })
    return NextResponse.json({ config })
  } catch (error) {
    console.error('fiscal PUT', error)
    return NextResponse.json({ error: 'Não foi possível salvar a configuração fiscal.' }, { status: 500 })
  }
}
