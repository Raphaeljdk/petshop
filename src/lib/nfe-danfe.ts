import { danfe, gerarPdf } from '@sinete/da/nfe'
import { validarDocumentoXsd } from './nfe-validacao-xsd'

export function gerarDanfeAutorizado(xml:string,cancelamento?:string){
 validarDocumentoXsd(xml,'autorizado')
 return Buffer.from(gerarPdf(danfe(xml,cancelamento?{cancelamento}:undefined)))
}
