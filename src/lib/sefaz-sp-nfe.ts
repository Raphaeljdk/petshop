import { createSecureContext } from 'node:tls'
import { request as httpsRequest } from 'node:https'

/** Endpoint NF-e modelo 55, SP, v4.00, publicado pela SEFAZ-SP. */
export const SEFAZ_SP = Object.freeze({
  uf: 'SP',
  codigoUf: '35',
  homologacao: {
    status: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    consulta: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  },
  producao: {
    status: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    consulta: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  },
})

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe'
const WSDL_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4'

/** Só consulta disponibilidade (tpAmb=2); NÃO cria, assina nem envia NF-e. */
export function soapStatusNfeSp() {
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body><nfeDadosMsg xmlns="' + WSDL_NS + '">' +
    '<consStatServ versao="4.00" xmlns="' + NFE_NS + '">' +
    '<tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ>' +
    '</nfeDadosMsg></soap12:Body></soap12:Envelope>'
}
export function interpretarRespostaStatusSefaz(xml: string) {
  // Um SOAP fault NÃO significa serviço em operação.
  if (/<(?:\w+:)?Fault\b/i.test(xml))
    return { disponivel: false, codigo: null, motivo: 'O serviço retornou uma falha SOAP.' }
  const c = xml.match(/<(?:\w+:)?cStat>\s*(\d+)\s*<\/(?:\w+:)?cStat>/i)
  const m = xml.match(/<(?:\w+:)?xMotivo>\s*([^<]{0,200})\s*<\/(?:\w+:)?xMotivo>/i)
  const codigo = c ? Number(c[1]) : null
  return { disponivel: codigo === 107, codigo, motivo: m?.[1]?.trim() || 'Resposta da SEFAZ sem motivo identificado.' }
}

export function lerA1DeVariaveis(env: {SEFAZ_NFE_A1_PFX_BASE64?:string; SEFAZ_NFE_A1_SENHA?:string}) {
  const encoded = env.SEFAZ_NFE_A1_PFX_BASE64?.trim() || ''
  const senha = env.SEFAZ_NFE_A1_SENHA
  if (!encoded || typeof senha !== 'string' || senha.length === 0)
    throw new Error('Configure SEFAZ_NFE_A1_PFX_BASE64 e SEFAZ_NFE_A1_SENHA na Vercel.')
  const clean = encoded.replace(/\s/g, '')
  if (clean.length > 200_000 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(clean) || clean.length % 4 !== 0)
    throw new Error('Arquivo A1 inválido ou acima do limite permitido.')
  const pfx = Buffer.from(clean, 'base64')
  if (pfx.length < 300 || pfx.length > 150_000)
    throw new Error('O conteúdo do certificado A1 é inválido.')
  try {
    // Verifica senha/formato local sem expor senha/chave. Não atesta CNPJ nem validade cadastral.
    createSecureContext({ pfx, passphrase: senha, minVersion: 'TLSv1.2' })
  } catch {
    throw new Error('O certificado A1 não pôde ser aberto. Confira o PFX e sua senha.')
  }
  return { pfx, passphrase: senha }
}

export class SefazComunicacaoError extends Error {
  constructor(readonly categoria: string, message: string) {
    super(message)
    this.name = 'SefazComunicacaoError'
  }
}
/** Nunca devolve mensagens originais de OpenSSL ao navegador: podem ter detalhes locais. */
export function classificarErroTransporteSefaz(error: unknown): SefazComunicacaoError {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code) : ''
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT')
    return new SefazComunicacaoError('tempo-esgotado', 'A conexão com a SEFAZ-SP demorou além do limite de 15 segundos. Tente novamente mais tarde.')
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code))
    return new SefazComunicacaoError('dns', 'O servidor não conseguiu localizar o endereço da SEFAZ-SP. Verifique DNS e disponibilidade.')
  if (['ECONNRESET', 'EPIPE'].includes(code))
    return new SefazComunicacaoError('conexao-encerrada', 'A comunicação foi encerrada durante a conexão. Pode ser incompatibilidade TLS, bloqueio de rede ou instabilidade da SEFAZ.')
  if (['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code))
    return new SefazComunicacaoError('rede', 'Não foi possível alcançar o serviço SEFAZ-SP a partir da hospedagem. Confira rede e disponibilidade.')
  if (/CERT_|CERTIFICATE|VERIFY|TLS|SSL|ERR_OSSL|X509/i.test(code))
    return new SefazComunicacaoError('certificado-tls', 'Falha na negociação TLS ou validação de certificado com a SEFAZ-SP. O A1 abriu localmente; a comunicação mTLS deve ser analisada.')
  return new SefazComunicacaoError('comunicacao', 'A SEFAZ-SP não respondeu normalmente à consulta de homologação. Verifique TLS, rede e credenciamento com o suporte técnico.')
}

export async function consultarStatusHomologacaoSefazSp(cred: {pfx: Buffer;passphrase: string}) {
  const endpoint = new URL(SEFAZ_SP.homologacao.status)
  const payload = soapStatusNfeSp()
  const action = WSDL_NS + '/nfeStatusServicoNF'
  const body = await new Promise<string>((resolve, reject) => {
    const req = httpsRequest(endpoint, {
      method: 'POST',
      pfx: cred.pfx,
      passphrase: cred.passphrase,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="' + action + '"',
        'Content-Length': String(Buffer.byteLength(payload)),
      },
    }, (res) => {
      const parts: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 128_000) {
          req.destroy(new Error('Resposta SEFAZ muito grande.'))
          return
        }
        parts.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => {
        if ((res.statusCode || 500) !== 200) {
          reject(new SefazComunicacaoError('http', 'A SEFAZ-SP retornou HTTP ' + (res.statusCode || 0) + ' ao consultar Status do Serviço em homologação. Verifique certificado e formato SOAP.'))
          return
        }
        resolve(Buffer.concat(parts).toString('utf8'))
      })
    })
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })))
    req.on('error', e => reject(e instanceof SefazComunicacaoError ? e : classificarErroTransporteSefaz(e)))
    req.end(payload)
  })
  const result = interpretarRespostaStatusSefaz(body)
  if (result.codigo === null && !result.motivo.includes('falha SOAP'))
    throw new SefazComunicacaoError('resposta', 'O serviço respondeu, mas não retornou um cStat reconhecível. Confira o envelope SOAP e a compatibilidade do serviço.')
  if (result.codigo === null)
    throw new SefazComunicacaoError('soap', 'A SEFAZ-SP respondeu com SOAP Fault. Confira versão 4.00, cabeçalhos e a requisição mTLS.')
  return result
}
