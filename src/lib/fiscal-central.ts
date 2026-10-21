/** Validação prévia universal, pura e sem qualquer operação fiscal externa. */
export type FiscalSale = {
  canal: string; status: string; total: number; marketplaceOrderId?: string|null;
  notaFiscal?: {status:string; chaveAcesso?:string|null; emissorDocumentoId?:string|null}|null;
  cliente?: {cpfCnpj?:string|null; endereco?:string|null; cep?:string|null}|null;
  marketplaceBuyerDocument?:string|null; enderecoEntrega?:string|null; cepEntrega?:string|null;
  itens: Array<{quantidade:number; precoUnit:number; produto:{
    nome:string;ncm?:string|null;origem?:string|null;unidadeFiscal?:string|null;cst?:string|null;csosn?:string|null;
  }}>
}
export type FiscalCompany = {
  cnpj?:string|null; inscricaoEstadual?:string|null; regimeTributario?:string|null;
  codigoMunicipio?:string|null;uf?:string|null;razaoSocial?:string|null;logradouro?:string|null;
  numeroEndereco?:string|null;bairro?:string|null;cep?:string|null;serieNfe?:number|null;
} | null;
export type ChecklistItem = { id:string;ok:boolean;texto:string };
export function isMercadoLivre(canal:string){return canal==='mercadolivre'||canal==='mercado_livre'}
export function avaliarEmissaoFiscal(input:{
  venda:FiscalSale;empresa:FiscalCompany;meliHabilitado:boolean;
  emissorUniversalConfigurado:boolean;emissorUniversalHomologado:boolean;
}) {
  const {venda,empresa}=input;
  const ml=isMercadoLivre(venda.canal), presencial=venda.canal==='loja';
  const checks:ChecklistItem[]=[];
  const add=(id:string,ok:boolean,texto:string)=>checks.push({id,ok,texto});
  add('canal',['site','amazon','loja','mercadolivre','mercado_livre'].includes(venda.canal),
    'Canal da operação identificado. Serviços são tratados separadamente por NFS-e.');
  add('pagamento',venda.status==='concluida'&&Number.isFinite(venda.total)&&venda.total>0,
    'Venda concluída e com valor válido.');
  add('itens',venda.itens.length>0&&venda.itens.every(i=>Number.isInteger(i.quantidade)&&i.quantidade>0&&Number.isFinite(i.precoUnit)&&i.precoUnit>=0),
    'Produtos e quantidades válidos.');
  const n=venda.notaFiscal;
  add('duplicidade',!n||(n.status==='rascunho'&&!n.chaveAcesso&&!n.emissorDocumentoId),
    'Não existe emissão solicitada, autorizada ou vinculada anteriormente.');
  if(ml){
    add('pedido-ml',/^mercadolivre:\d{8,20}$/.test(venda.marketplaceOrderId||''),'ID do pedido Mercado Livre reconhecido.');
    add('permissao',input.meliHabilitado,'Permissão e liberação da emissão fiscal no Mercado Livre.');
  }else{
    add('empresa',!!empresa?.cnpj&&/^\d{14}$/.test(empresa.cnpj.replace(/\D/g,''))&&
      !!empresa.razaoSocial&&!!empresa.inscricaoEstadual&&!!empresa.uf&&!!empresa.codigoMunicipio&&
      !!empresa.logradouro&&!!empresa.numeroEndereco&&!!empresa.bairro&&!!empresa.cep&&
      !!empresa.regimeTributario,'Cadastro do emitente completo (CNPJ, IE, CRT e endereço).');
    add('tributacao',venda.itens.every(i=>/^\d{8}$/.test((i.produto.ncm||'').replace(/\D/g,''))&&
      /^[0-8]$/.test(i.produto.origem||'')&&!!i.produto.unidadeFiscal&&
      (!!i.produto.cst||!!i.produto.csosn)),
      'NCM, origem, unidade e CST/CSOSN classificados pelo contador.');
    add('destinatario',!!(venda.marketplaceBuyerDocument||venda.cliente?.cpfCnpj),
      'Documento do destinatário disponível para validação quando exigido.');
    if(!presencial)add('endereco',!!(venda.enderecoEntrega||venda.cliente?.endereco)&&
      !!(venda.cepEntrega||venda.cliente?.cep),'Endereço e CEP de entrega disponíveis.');
    add('uf-sefaz',empresa?.uf?.trim().toUpperCase()==='SP',
      'O emissor próprio atual usa exclusivamente web services da SEFAZ-SP para NF-e modelo 55.');
    add('certificado-a1',input.emissorUniversalConfigurado,
      'Certificado A1 e senha protegidos configurados no servidor (ainda exigem validação mTLS).');
    add('homologacao',input.emissorUniversalHomologado,
      'Geração de XML, assinatura, schema 2026 e transmissão fiscal homologados pela contabilidade.');
    add('transmissao',false,
      'Emissão direta SEFAZ ainda NÃO habilitada: é necessário XML NF-e atualizado, assinatura e conciliação. O teste de status não emite notas.');
  }
  const ready=checks.every(c=>c.ok);
  return {canal:venda.canal,modeloSugerido:presencial?'65':'55',tipo:presencial?'NFC-e':'NF-e',
    provedor:ml?'mercado_livre':'sefaz_sp',checks,prontoParaSolicitar:ready,
    habilitadoParaEmissao:ml&&ready,simulado:true,transmitido:false,
    aviso:'Simulação segura: não foi transmitida uma nota à SEFAZ e não foi criado protocolo, XML ou DANFE.'};
}
