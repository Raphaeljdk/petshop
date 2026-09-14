import { db } from '@/lib/db'
import type { ConfiguracaoFrete as ConfigFretePrisma } from '@prisma/client'
import type { ConfiguracaoFrete, OpcaoFrete, TipoEntrega } from '@/lib/types'

/**
 * Helpers de frete do Matilha Prado.
 *
 * Modelo:
 *  - Retirada na loja (sempre disponível se ativa)
 *  - Entrega própria (apenas para CEPs dentro da faixa de SP capital)
 *  - Sedex (simulado, para qualquer CEP válido do Brasil)
 */

const CEP_REGEX = /^\d{5}-?\d{3}$/

/** Normaliza o CEP removendo tudo que não for dígito. */
export function normalizarCep(cep: string): string {
  return (cep || '').replace(/\D/g, '').slice(0, 8)
}

/** Formata o CEP no padrão XXXXX-XXX. */
export function formatarCep(cep: string): string {
  const limpo = normalizarCep(cep)
  if (limpo.length <= 5) return limpo
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`
}

/** Valida o CEP informado (8 dígitos). */
export function validarCep(cep: string): boolean {
  const limpo = normalizarCep(cep)
  return limpo.length === 8
}

/** Aplica máscara enquanto o usuário digita. */
export function aplicarMascaraCep(valor: string): string {
  const limpo = valor.replace(/\D/g, '').slice(0, 8)
  if (limpo.length <= 5) return limpo
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`
}

/**
 * Compara dois CEPs normalizados como inteiros de 8 dígitos.
 * Faixa inclusiva nos dois extremos.
 */
function cepDentroDeFaixa(
  cep: string,
  cepInicial: string,
  cepFinal: string
): boolean {
  const n = parseInt(normalizarCep(cep).padEnd(8, '0'), 10)
  const ini = parseInt(normalizarCep(cepInicial).padEnd(8, '0'), 10)
  const fim = parseInt(normalizarCep(cepFinal).padEnd(8, '0'), 10)
  if (Number.isNaN(n) || Number.isNaN(ini) || Number.isNaN(fim)) return false
  return n >= ini && n <= fim
}

/**
 * Calcula um valor "simulado" de Sedex baseado no CEP.
 * Em produção isso chamaria a API real dos Correios (SIGEP).
 *
 * Lógica determinística baseada em hash simples do CEP + faixa:
 *  - Dentro de SP capital: R$ 25 a R$ 40
 *  - Demais localidades (BR): R$ 30 a R$ 60
 */
export function calcularValorSedex(cep: string, dentroSP: boolean): number {
  const limpo = normalizarCep(cep)
  // soma simples dos dígitos para variar o valor
  let soma = 0
  for (let i = 0; i < limpo.length; i++) {
    soma += parseInt(limpo[i] || '0', 10) * (i + 1)
  }
  const min = dentroSP ? 25 : 30
  const max = dentroSP ? 40 : 60
  const delta = max - min
  // espalha usando o resto da soma
  const valor = min + (soma % (delta + 1))
  // Arredonda para 0,50 mais próxima
  return Math.round(valor * 2) / 2
}

/**
 * Retorna as configurações atuais de frete, criando um registro
 * padrão se ainda não existir nenhum.
 */
export async function getOuCriarConfigFrete(): Promise<ConfiguracaoFrete> {
  let config: ConfigFretePrisma | null = await db.configuracaoFrete.findFirst()
  if (!config) {
    config = await db.configuracaoFrete.create({ data: {} })
  }
  // Prisma retorna Date, serializamos para string (NextResponse.json)
  return {
    ...config,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}

/**
 * Calcula as opções de entrega disponíveis para um CEP informado.
 *
 * @param cep CEP bruto (com ou sem máscara)
 */
export async function calcularOpcoesFrete(
  cep: string
): Promise<{ opcoes: OpcaoFrete[]; dentroSP: boolean; config: ConfiguracaoFrete }> {
  const config = await getOuCriarConfigFrete()
  const opcoes: OpcaoFrete[] = []
  const cepValido = CEP_REGEX.test(cep) && validarCep(cep)
  const dentroSP =
    cepValido &&
    cepDentroDeFaixa(
      cep,
      config.entregaPropriaCepInicial,
      config.entregaPropriaCepFinal
    )

  // 1. Retirada na loja (sempre que ativa, mesmo para CEP inválido)
  if (config.retiradaAtiva) {
    opcoes.push({
      tipo: 'retirada',
      label: 'Retirada na loja',
      valor: 0,
      prazo: config.retiradaPrazo,
      descricao: 'Grátis',
      enderecoRetirada: config.retiradaEndereco,
      disponivel: true,
    })
  }

  // 2. Entrega própria (somente para CEP dentro de SP capital)
  if (config.entregaPropriaAtiva && cepValido && dentroSP) {
    opcoes.push({
      tipo: 'entrega_propria',
      label: 'Entrega própria (Santana e região)',
      valor: config.entregaPropriaValor,
      prazo: config.entregaPropriaPrazo,
      descricao: 'Entregamos até a sua porta',
      disponivel: true,
    })
  }

  // 3. Sedex (qualquer CEP válido do Brasil)
  if (config.sedexAtivo && cepValido) {
    opcoes.push({
      tipo: 'sedex',
      label: 'Sedex (Correios)',
      valor: calcularValorSedex(cep, dentroSP),
      prazo: config.sedexPrazo,
      descricao: 'Envio nacional',
      disponivel: true,
    })
  }

  return { opcoes, dentroSP: !!dentroSP, config }
}

/**
 * Recupera os detalhes de uma opção específica de entrega para um CEP.
 * Útil para o backend confirmar o valor antes de salvar a venda.
 */
export async function getOpcaoFrete(
  cep: string,
  tipo: TipoEntrega
): Promise<OpcaoFrete | null> {
  const { opcoes } = await calcularOpcoesFrete(cep)
  return opcoes.find((o) => o.tipo === tipo) || null
}
