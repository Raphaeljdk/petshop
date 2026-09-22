export type SiggmaTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
  scope?: string
}

export type SiggmaApiWarning = {
  type: 'warning' | 'error'
  code?: number
  msg?: string
  message?: string
  detail?: string | null
}

export type SiggmaApiSuccess = { type: 'success' }

export type SiggmaMetadata = {
  paginas: number
  pagina: number
  total?: number
}

export type SiggmaPage<T> = {
  metadata: SiggmaMetadata
  data: T[]
}

export type SiggmaPessoa = {
  id?: number
  tipo?: string
  nome?: string
  cpfcnpj?: string
  telefone?: string
  celular?: string
  email?: string
  endereco?: string
  numero?: string
  complemento?: string | null
  bairro?: string
  cep?: string
  municipio?: string
  uf?: string
  dataAtualizacao?: string
}

export type SiggmaCliente = {
  cliCod: number
  cliDoc?: string
  cliTpo?: string
  dataAtualizacao?: string
  pessoa?: SiggmaPessoa
  status?: {
    cliestCod?: number
    cliestDes?: string
    cliestBlock?: boolean
    inativar?: boolean
  }
}

export type SiggmaAnimal = {
  id: number
  nome?: string
  especie?: string | null
  raca?: string | null
  pelagem?: string | null
  porte?: string | null
  cor?: string | null
  condicao?: string | null
  comportamento?: string | null
  observacoes?: string | null
  status?: string | null
  imagem?: {
    type?: string
    imagems?: string
    imagemMin?: string | null
  } | null
  filial?: number | null
  dataAtualizacao?: string
  cliente?: SiggmaCliente | null
}

export type SiggmaVacina = {
  id: number
  intervaloDias?: number
  terceiros?: boolean
  dataHora?: string
  descricao?: string
  observacoes?: string | null
  animal?: number
  vacinaAnterior?: number | null
  status?: string
  dataAtualizacao?: string
}

export type SiggmaAtendimento = {
  id: number
  tipo?: string | null
  peso?: string | number | null
  anexos?: unknown
  status?: string | null
  animal?: number | null
  servico?: number | string | null
  cliente?: number | null
  datahora?: string | null
  excluido?: boolean
  tipoServico?: string | null
  observacoes?: string | null
  datahoraFinal?: string | null
  dataAtualizacao?: string | null
  dadosEspecificos?: Record<string, unknown> | null
}

export type SiggmaProduto = {
  codigo_integracao?: number | null
  pro_cod: number
  codigo?: string
  gtin?: string
  nome?: string
  complemento?: string
  observacao?: string
  preco?: string
  peso?: string
  estoque_min?: string
  altura?: string
  largura?: string
  comprimento?: string
  marca?: string
  modelo?: string
  estoque?: string
  inativar_itens?: string
  excluido?: string
  valor_promocao?: string | null
  imagens?: string[]
  categorias?: number[]
  variacoes?: Array<Record<string, unknown>>
  genero?: string | null
}

export type SiggmaCategoria = {
  id: number
  ecommerce?: number
  nome?: string
  parent_id?: number | null
  status?: string
  data_atualizacao?: string
  excluido?: boolean
  ecommerce_codigo?: string | null
  icon?: string | null
  ordem?: number | null
}

export type SiggmaClienteImportInput = {
  cliCod?: number
  cliDoc?: string
  dataAtualizacao?: string
  cliObs?: string
  cliNeg?: boolean
  consumidorFinal?: boolean
  pessoa?: Record<string, unknown>
}

export type SiggmaClienteImportResult = {
  type: 'success' | 'error' | 'warning'
  data?: Array<{ cpfcnpj?: string | null; cliente?: number; erro?: string }>
  msg?: string
  message?: string
}

export type SiggmaPedidoImportInput = {
  id: number
  dataCriacao: string
  guid: string
  status?: string
  cpfCnpj?: string
  nome?: string
  email?: string
  telefone?: string
  celular?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  valorFrete: string
  totalProduto: string
  desconto: string
  despesas: string
  totalGeral: string
  item: Array<{
    sku: string
    codigoIntegracao?: number
    descricao?: string
    qtd: string
    preco: string
    total: string
    desconto: string
    despesas: string
    valorFrete: string
    totalGeral: string
  }>
}

export type SiggmaFiscalStatus = {
  guid: string
  status:
    | 'PROCESSADA'
    | 'ENVIADA'
    | 'HOMOLOGADA'
    | 'CONTINGENCIA'
    | 'ERRO'
    | 'DENEGADA'
    | 'CANCELADO'
    | 'EXCLUIDO'
}

export type SiggmaFiscalStatusResponse = {
  type: 'success'
  data: SiggmaFiscalStatus[]
}
