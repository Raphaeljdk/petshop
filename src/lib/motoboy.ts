/**
 * Tarifas comerciais do motoboy, compartilhadas entre servidor e interface.
 * Faixas operacionais baseadas na tabela de CEP da Prefeitura de São Paulo:
 * https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/direitos_humanos/participacao_social/CONSELHOS/CONSELHO_IDOSO/ELEICAO/2023/Tabela%20CEP%20(1).pdf
 * CEPs são divisões postais, não limites exatos de distritos. Nas faixas
 * compartilhadas, 015 usa a tarifa Centro e 051 usa a tarifa Norte.
 * Oeste e municípios vizinhos não têm tarifa autorizada nesta tabela.
 */
export const MOTOBOY_REGIOES = [
  { id: 'norte', nome: 'Zona Norte', valor: 20, faixas: [[2000000, 2999999], [5100000, 5299999]] },
  { id: 'leste', nome: 'Zona Leste', valor: 30, faixas: [[3000000, 3999999], [8000000, 8499999]] },
  { id: 'centro', nome: 'Centro', valor: 30, faixas: [[1000000, 1399999], [1500000, 1599999]] },
  { id: 'sul', nome: 'Zona Sul', valor: 40, faixas: [[4000000, 4999999], [5700000, 5899999]] },
] as const

export function regiaoMotoboyPorCep(cep: string) {
  // Não truncar entradas inválidas para evitar aceitar outro CEP por acidente.
  if (!/^\d{5}-?\d{3}$/.test(cep)) return null
  const numero = Number(cep.replace('-', ''))
  return MOTOBOY_REGIOES.find(regiao =>
    regiao.faixas.some(([inicio, fim]: readonly [number, number]) => numero >= inicio && numero <= fim)
  ) ?? null
}
