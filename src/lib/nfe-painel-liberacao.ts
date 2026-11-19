/**
 * Diagnóstico factual de liberação fiscal. Nenhuma contagem de documentos do ERP
 * comprova por si só sequência externa, autorização oficial ou aptidão para produção.
 */
export type NotaConferencia = {
 serie:number|null;numero:number|null;modelo:string;status:string;emissor:string|null
}
export type NotaTesteConferencia = {
 serie:number;numero:number;status:string;codigoSefaz:number|null
 protocolo:string|null;temXml:boolean
}
export function comporPainelLiberacao(input:{
 notas:NotaConferencia[];testes:NotaTesteConferencia[];
 emissaoRealImplementada:boolean;emailAutomatico:boolean;regrasAtivas:number
}) {
 const testes=input.testes.filter(n=>n.serie===2)
 const n1=testes.find(n=>n.numero===1)
 const autorizada=testes.filter(n=>n.status==='autorizada'&&
   [100,150].includes(n.codigoSefaz||0)&&/^\d{15}$/.test(n.protocolo||'')&&n.temXml)
 const series=new Map<number,{serie:number;quantidade:number;maiorConhecido:number;emissores:Set<string>}>()
 for(const n of input.notas){
  if(n.modelo!=='55'||n.serie==null||n.numero==null)continue
  const atual=series.get(n.serie)||{serie:n.serie,quantidade:0,maiorConhecido:0,emissores:new Set<string>()}
  atual.quantidade++;atual.maiorConhecido=Math.max(atual.maiorConhecido,n.numero)
  atual.emissores.add(n.emissor||'nao_informado')
  series.set(n.serie,atual)
 }
 const numero1=n1?{
  status:n1.status,codigoSefaz:n1.codigoSefaz,
  precisaConsulta:!(n1.status==='autorizada'&&n1.temXml&&/^\d{15}$/.test(n1.protocolo||'')),
 }:{status:'nao_localizada',codigoSefaz:null,precisaConsulta:true}
 const serieProducaoConfirmada=false // só conciliação EXTERNA pode liberar; não inferir do banco
 const pendencias:string[]=[]
 if(numero1.precisaConsulta)pendencias.push('Consultar na SEFAZ a chave original da nota de teste nº 1 (não criar outra nota).')
 if(!autorizada.length)pendencias.push('Conseguir autorização cStat 100/150 em homologação com protocolo e XML.')
 if(!serieProducaoConfirmada)pendencias.push('Confirmar a série e o próximo número de produção com TODOS os emissores externos.')
 if(!input.emissaoRealImplementada)pendencias.push('Implementar, homologar e habilitar explicitamente o emissor de NF-e real.')
 if(!input.emailAutomatico)pendencias.push('Testar o e-mail autorizado antes de ativar NFE_EMAIL_AUTOMATICO_ENABLED.')
 return {
  nota1:numero1,
  autorizadasHomologacao:autorizada.map(n=>({serie:n.serie,numero:n.numero,codigoSefaz:n.codigoSefaz})),
  seriesConhecidas:[...series.values()].sort((a,b)=>a.serie-b.serie).map(s=>({
   serie:s.serie,quantidade:s.quantidade,maiorConhecido:s.maiorConhecido,
   emissores:[...s.emissores].sort(),
  })),
  serieProducaoConfirmada,emissaoRealHabilitada:false,
  emailAutomatico:input.emailAutomatico,regrasAtivas:input.regrasAtivas,
  pendencias,
  aviso:'Somente leitura. Histórico incompleto não confirma próxima numeração. Não altera notas nem transmite à SEFAZ.',
 }
}
