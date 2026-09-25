import { db } from '@/lib/db'
import type { ConfiguracaoFrete as ConfigFretePrisma } from '@prisma/client'
import type { ConfiguracaoFrete, OpcaoFrete, TipoEntrega } from '@/lib/types'

/**
 * Regras de entrega do Matilha Prado.
 *
 * Política atual definida pelo cliente:
 *  - Motoboy próprio somente na Zona Norte de São Paulo
 *  - Valor fixo de R$ 20,00
 *  - CEPs aceitos: 02000-000 a 02999-999
 *  - Correios/Sedex desativado
 *  - Retirada na loja continua disponível quando habilitada
 */

const CEP_REGEX = /^\d{5}-?\d{3}$/
export const MOTOBOY_ZONA_NORTE_CEP_INICIAL = '02000-000'
export const MOTOBOY_ZONA_NORTE_CEP_FINAL = '02999-999'
export const MOTOBOY_ZONA_NORTE_VALOR = 20
export const HORARIO_FUNCIONAMENTO_INICIO = '09:00'
export const HORARIO_FUNCIONAMENTO_FIM = '20:00'
export const HORARIO_FUNCIONAMENTO_LABEL = '09h às 20h'
export const PRAZO_MAXIMO_ENTREGA = 'Até 4 horas'
export const PRAZO_MAXIMO_RETIRADA = 'Pronto para retirada em até 4 horas'

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
  return normalizarCep(cep).length === 8
}

/** Aplica máscara enquanto o usuário digita. */
export function aplicarMascaraCep(valor: string): string {
  const limpo = valor.replace(/\D/g, '').slice(0, 8)
  if (limpo.length <= 5) return limpo
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`
}

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
 * Mantido apenas para compatibilidade com pedidos antigos que possam ter usado Sedex.
 * Novos cálculos de frete não oferecem Correios/Sedex.
 */
export function calcularValorSedex(cep: string, dentroSP: boolean): number {
  const limpo = normalizarCep(cep)
  let soma = 0
  for (let i = 0; i < limpo.length; i++) {
    soma += parseInt(limpo[i] || '0', 10) * (i + 1)
  }
  const min = dentroSP ? 25 : 30
  const max = dentroSP ? 40 : 60
  return Math.round((min + (soma % (max - min + 1))) * 2) / 2
}

/**
 * Retorna as configurações atuais de frete.
 *
 * As regras de motoboy são normalizadas aqui para refletirem a política comercial
 * vigente sem depender de uma migração manual do registro já existente no banco.
 */
export async function getOuCriarConfigFrete(): Promise<ConfiguracaoFrete> {
  let config: ConfigFretePrisma | null = await db.configuracaoFrete.findFirst()

  if (!config) {
    config = await db.configuracaoFrete.create({
      data: {
        entregaPropriaAtiva: true,
        entregaPropriaValor: MOTOBOY_ZONA_NORTE_VALOR,
        entregaPropriaCepInicial: MOTOBOY_ZONA_NORTE_CEP_INICIAL,
        entregaPropriaCepFinal: MOTOBOY_ZONA_NORTE_CEP_FINAL,
        entregaPropriaPrazo: PRAZO_MAXIMO_ENTREGA,
        retiradaAtiva: true,
        retiradaPrazo: PRAZO_MAXIMO_RETIRADA,
        sedexAtivo: false,
      },
    })
  } else if (
    !config.entregaPropriaAtiva ||
    config.entregaPropriaValor !== MOTOBOY_ZONA_NORTE_VALOR ||
    config.entregaPropriaCepInicial !== MOTOBOY_ZONA_NORTE_CEP_INICIAL ||
    config.entregaPropriaCepFinal !== MOTOBOY_ZONA_NORTE_CEP_FINAL ||
    config.entregaPropriaPrazo !== PRAZO_MAXIMO_ENTREGA ||
    !config.retiradaAtiva ||
    config.retiradaPrazo !== PRAZO_MAXIMO_RETIRADA ||
    config.sedexAtivo
  ) {
    config = await db.configuracaoFrete.update({
      where: { id: config.id },
      data: {
        entregaPropriaAtiva: true,
        entregaPropriaValor: MOTOBOY_ZONA_NORTE_VALOR,
        entregaPropriaCepInicial: MOTOBOY_ZONA_NORTE_CEP_INICIAL,
        entregaPropriaCepFinal: MOTOBOY_ZONA_NORTE_CEP_FINAL,
        entregaPropriaPrazo: PRAZO_MAXIMO_ENTREGA,
        retiradaAtiva: true,
        retiradaPrazo: PRAZO_MAXIMO_RETIRADA,
        sedexAtivo: false,
      },
    })
  }

  return {
    ...config,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}

/**
 * Calcula as opções de entrega disponíveis para o CEP informado.
 * Motoboy só aparece para CEPs da faixa 02000-000 a 02999-999.
 */
export async function calcularOpcoesFrete(
  cep: string
): Promise<{ opcoes: OpcaoFrete[]; dentroSP: boolean; config: ConfiguracaoFrete }> {
  const config = await getOuCriarConfigFrete()
  const opcoes: OpcaoFrete[] = []
  const cepValido = CEP_REGEX.test(cep) && validarCep(cep)

  const dentroZonaNorte =
    cepValido &&
    cepDentroDeFaixa(
      cep,
      MOTOBOY_ZONA_NORTE_CEP_INICIAL,
      MOTOBOY_ZONA_NORTE_CEP_FINAL
    )

  if (config.retiradaAtiva) {
    opcoes.push({
      tipo: 'retirada',
      label: 'Retirada na loja',
      valor: 0,
      prazo: config.retiradaPrazo,
      descricao: `Grátis · Retirada no horário de funcionamento (${HORARIO_FUNCIONAMENTO_LABEL})`,
      enderecoRetirada: config.retiradaEndereco,
      disponivel: true,
    })
  }

  if (dentroZonaNorte) {
    opcoes.push({
      tipo: 'entrega_propria',
      label: 'Motoboy Matilha Prado',
      valor: MOTOBOY_ZONA_NORTE_VALOR,
      prazo: config.entregaPropriaPrazo,
      descricao: `Entrega própria na Zona Norte de São Paulo · ${HORARIO_FUNCIONAMENTO_LABEL}`,
      disponivel: true,
    })
  }

  // Sedex/Correios está intencionalmente desativado para novos pedidos.
  return { opcoes, dentroSP: !!dentroZonaNorte, config }
}

export async function getOpcaoFrete(
  cep: string,
  tipo: TipoEntrega
): Promise<OpcaoFrete | null> {
  const { opcoes } = await calcularOpcoesFrete(cep)
  return opcoes.find((o) => o.tipo === tipo) || null
}
