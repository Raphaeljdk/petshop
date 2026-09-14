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

export interface Venda {
  id: string
  clienteId: string | null
  total: number
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
  createdAt: string
  updatedAt: string
  cliente?: Cliente | null
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
}

export interface PagamentoCriarResposta {
  preferenceId: string
  initPoint: string
  qrCode?: string
  qrCodeBase64?: string
  pixCopiaECola?: string
  pixExpiresAt?: string
  boletoUrl?: string
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
