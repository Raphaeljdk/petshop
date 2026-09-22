// Tipos compartilhados do sistema Matilha Prado

export type StatusProcesso =
  | 'novo'
  | 'em_andamento'
  | 'aguardando_resposta'
  | 'finalizado'
  | 'cancelado'

export type StatusAgendamento =
  | 'agendado'
  | 'confirmado'
  | 'concluido'
  | 'cancelado'

export type StatusVenda = 'concluida' | 'pendente' | 'cancelada'

export type StatusEntrega = 'pendente' | 'enviada' | 'entregue' | 'cancelada'

export type TipoEntrega = 'retirada' | 'entrega_propria' | 'sedex'

export type CanalVenda = 'loja' | 'site' | 'mercado_livre' | 'amazon'

export type TipoNotificacao = 'sms' | 'email' | 'whatsapp' | 'push'

export type PlataformaIntegracao = 'mercado_livre' | 'amazon' | 'mercado_pago' | 'correios'

export interface Cliente {
  id: string
  nome: string
  telefone: string
  cpfCnpj?: string | null
  email: string | null
  endereco: string | null
  cep: string | null
  createdAt: string
  updatedAt: string
  pets?: Pet[]
  agendamentos?: Agendamento[]
  vendas?: Venda[]
}

export interface Pet {
  id: string
  nome: string
  especie: string
  raca: string | null
  idade: string | null
  peso: string | null
  fotoUrl: string | null
  observacoes: string | null
  clienteId: string
  createdAt: string
  updatedAt: string
  cliente?: Cliente
  processos?: Processo[]
  agendamentos?: Agendamento[]
  origem?: 'local' | 'zetta'
  zettaId?: number
}

export interface Processo {
  id: string
  petId: string
  status: StatusProcesso
  servico: string
  responsavel: string | null
  anamnese: string | null
  inicioAtendimento: string | null
  fimAtendimento: string | null
  valorServico: number
  notificadoEm: string | null
  createdAt: string
  updatedAt: string
  pet?: Pet
  notificacoes?: Notificacao[]
  origem?: 'local' | 'zetta'
  statusOriginal?: string | null
}

export interface Agendamento {
  id: string
  petId: string
  clienteId: string
  servico: string
  dataHora: string
  status: StatusAgendamento
  observacoes: string | null
  createdAt: string
  updatedAt: string
  pet?: Pet
  cliente?: Cliente
  origem?: 'local' | 'siggma'
  siggmaId?: number | null
  statusOriginal?: string | null
  cancelavel?: boolean
}

export interface Produto {
  id: string
  nome: string
  descricao: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  sku: string | null
  zettaProCod?: number | null
  mlItemId: string | null
  amazonAsin: string | null
  imageUrl: string | null
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export interface ItemVenda {
  id: string
  vendaId: string
  produtoId: string
  quantidade: number
  precoUnit: number
  produto?: Produto
}

export interface CupomResumo {
  id: string
  codigo: string
  descricao: string | null
  tipoDesconto: 'percentual' | 'fixo'
  valor: number
  influenciadorNome: string | null
  comissaoPercentual: number
}

export interface Venda {
  id: string
  clienteId: string | null
  total: number
  subtotalProdutos: number | null
  cupomId: string | null
  cupomCodigo: string | null
  descontoCupom: number
  canal: CanalVenda
  status: StatusVenda
  observacoes: string | null
  // Campos de entrega
  tipoEntrega: TipoEntrega | null
  valorFrete: number | null
  cepEntrega: string | null
  enderecoEntrega: string | null
  prazoEntrega: string | null
  codigoRastreio: string | null
  statusEntrega: StatusEntrega | null
  // Mercado Pago
  mercadoPagoId: string | null
  mercadoPagoStatus: StatusMercadoPago | null
  mercadoPagoPaymentUrl: string | null
  mercadoPagoQrCode: string | null
  mercadoPagoPixExpiresAt: string | null
  siggmaGuid?: string | null
  siggmaImportStatus?: string | null
  siggmaImportedAt?: string | null
  siggmaImportError?: string | null
  statusFiscal?: string | null
  createdAt: string
  updatedAt: string
  cliente?: Cliente | null
  cupom?: CupomResumo | null
  itens?: ItemVenda[]
}

export type StatusMercadoPago =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'in_process'
  | 'in_mediation'
  | 'authorized'

export type MetodoPagamento = 'pix' | 'cartao' | 'boleto'

export interface ConfiguracaoPagamento {
  id: string
  mercadoPagoAtivo: boolean
  mercadoPagoAccessToken: string | null
  mercadoPagoPublicKey: string | null
  mercadoPagoSandbox: boolean
  pixAtivo: boolean
  cartaoAtivo: boolean
  boletoAtivo: boolean
  createdAt: string
  updatedAt: string
  /** Campos calculados pelo servidor para diagnóstico do Checkout Transparente. */
  publicKey?: string | null
  ambienteConfigurado?: boolean
  accessTokenConfigurado?: boolean
  publicKeyConfigurada?: boolean
  checkoutPronto?: boolean
  webhookSecretConfigurado?: boolean
}

export interface PagamentoCriarResposta {
  /** Compatibilidade: no Checkout Transparente este campo contém o orderId. */
  preferenceId: string
  /** URL auxiliar (ticket Pix/Boleto). Cartão não redireciona para Checkout Pro. */
  initPoint: string
  orderId?: string
  orderStatus?: string
  statusDetail?: string
  qrCode?: string
  qrCodeBase64?: string
  pixCopiaECola?: string
  pixExpiresAt?: string
  boletoUrl?: string
  boletoLinhaDigitavel?: string
  boletoCodigoBarras?: string
  challengeUrl?: string
  simulado: boolean
  mercadoPagoId?: string
}

export interface OpcaoFrete {
  tipo: TipoEntrega
  label: string
  valor: number
  prazo: string
  descricao?: string
  enderecoRetirada?: string
  disponivel: boolean
}

export interface ConfiguracaoFrete {
  id: string
  entregaPropriaAtiva: boolean
  entregaPropriaValor: number
  entregaPropriaPrazo: string
  entregaPropriaCepInicial: string
  entregaPropriaCepFinal: string
  sedexAtivo: boolean
  sedexPrazo: string
  retiradaAtiva: boolean
  retiradaPrazo: string
  retiradaEndereco: string
  createdAt: string
  updatedAt: string
}

export interface Notificacao {
  id: string
  tipo: TipoNotificacao
  destino: string
  mensagem: string
  processoId: string | null
  status: string
  createdAt: string
  enviadaEm: string | null
  processo?: Processo | null
}

export interface Integracao {
  id: string
  plataforma: PlataformaIntegracao
  ativo: boolean
  token: string | null
  sellerId: string | null
  domain: string | null
  ultimaSync: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  zetta?: {
    online: boolean
    clientes: number
    pets: number
    produtos: number
    atendimentos: number
    contasPortal: number
    contasVinculadas: number
    ultimosAtendimentos: Array<{
      id: number | string
      clienteId?: number | string | null
      datahora?: string | null
      status?: string | null
      total?: number | string | null
      totalItens?: number | string | null
      filial?: number | string | null
    }>
  }
  totalClientes: number
  totalPets: number
  totalProdutos: number
  totalVendas: number
  totalAgendamentos: number
  totalProcessos: number
  totalProcessosAndamento: number
  faturamentoHoje: number
  faturamentoMes: number
  vendasHoje: number
  agendamentosHoje: number
  estoqueBaixo: number
  ultimosProcessos: Processo[]
  ultimasVendas: Venda[]
  proximosAgendamentos: Agendamento[]
  vendasPorMes: Array<{ mes: string; total: number }>
  vendasPorCanal: Array<{ canal: string; total: number; quantidade: number }>
  topProdutos: Array<{ nome: string; quantidade: number; total: number }>
  petsPorEspecie: Array<{ especie: string; quantidade: number }>
  processosPorStatus: Array<{ status: string; quantidade: number }>
  agendamentosPorServico: Array<{ servico: string; quantidade: number }>
}
