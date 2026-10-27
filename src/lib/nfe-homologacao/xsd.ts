import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateXML } from 'xmllint-wasm'
import manifest from '../../../schemas/nfe/manifest.json'

const entradas = {
  nota: 'nfe_v4.00.xsd', lote: 'enviNFe_v4.00.xsd',
  consulta: 'consSitNFe_v4.00.xsd', recibo: 'consReciNFe_v4.00.xsd',
  autorizada: 'procNFe_v4.00.xsd',
} as const

/** Offline: somente esquemas versionados, integridade verificada e sem DTD/entidades. */
export async function validarXsdHomologacao(xml: string, tipo: keyof typeof entradas = 'nota') {
  if (Buffer.byteLength(xml, 'utf8') > 512000 || /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml))
    throw new Error('XML excede o limite ou contém construção proibida.')
  if (!(tipo in entradas)) throw new Error('Tipo de esquema não permitido.')
  const pasta = path.join(process.cwd(), 'schemas/nfe/PL_010g_v1.03/NFe')
  const arquivos = await Promise.all(Object.entries(manifest.files).map(async ([fileName, hash]) => {
    const bytes = await readFile(path.join(pasta, fileName))
    if (createHash('sha256').update(bytes).digest('hex') !== hash)
      throw new Error('Integridade do pacote XSD não confirmada.')
    return { fileName, contents: bytes.toString('utf8') }
  }))
  const schema = arquivos.find(f => f.fileName === entradas[tipo])!
  const resultado = await validateXML({
    xml: { fileName: 'documento.xml', contents: xml }, schema,
    preload: arquivos.filter(f => f !== schema),
    maxMemoryPages: 1024,
    modifyArguments: args => ['--nonet', ...args],
  })
  // Mensagens libxml podem reproduzir dados fiscais: não retornar conteúdo bruto.
  return { valido: resultado.valid, pacote: manifest.package,
    erros: resultado.errors.map(e => ({ linha: e.loc?.lineNumber ?? null,
      mensagem: 'Documento incompatível com o esquema oficial.' })) }
}
