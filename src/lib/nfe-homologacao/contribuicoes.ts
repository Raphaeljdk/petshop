/** Valores decimais explícitos; nenhum tributo é inferido do cadastro do produto. */
export type Contribuicao =
  | { modalidade: 'percentual'; cst: '01'|'02'|'49'|'99'; base: string; aliquota: string; valor: string }
  | { modalidade: 'quantidade'; cst: '03'|'49'|'99'; quantidade: string; aliquotaReais: string; valor: string }
  | { modalidade: 'nao-tributada'; cst: '04'|'05'|'06'|'07'|'08'|'09' }

function unidades(value: string, casas: number): bigint {
  if (typeof value !== 'string' || !new RegExp('^(0|[1-9][0-9]{0,10})\\.[0-9]{'+casas+'}$').test(value))
    throw new Error('Valor fiscal ausente ou fora da precisão exigida.')
  return BigInt(value.replace('.', ''))
}
const tag = (nome: string, valor: string) => '<'+nome+'>'+valor+'</'+nome+'>'

export function gerarContribuicao(nome: 'PIS'|'COFINS', dado: Contribuicao) {
  let grupo: string
  let campos = ''
  let valor = BigInt(0)
  if (dado.modalidade === 'nao-tributada') {
    if (!['04','05','06','07','08','09'].includes(dado.cst)) throw new Error('CST incompatível com grupo NT.')
    grupo = nome+'NT'
  } else {
    valor = unidades(dado.valor, 2)
    let numerador: bigint
    let divisor: bigint
    if (dado.modalidade === 'percentual') {
      if (!['01','02','49','99'].includes(dado.cst)) throw new Error('CST incompatível com cálculo percentual.')
      const base = unidades(dado.base, 2)
      const taxa = unidades(dado.aliquota, 4)
      if (taxa > BigInt(1000000)) throw new Error('Alíquota acima de 100%.')
      numerador = base * taxa
      divisor = BigInt(1000000)
      campos = tag('vBC', dado.base)+tag('p'+nome, dado.aliquota)
      grupo = ['49','99'].includes(dado.cst) ? nome+'Outr' : nome+'Aliq'
    } else if (dado.modalidade === 'quantidade') {
      if (!['03','49','99'].includes(dado.cst)) throw new Error('CST incompatível com cálculo por quantidade.')
      numerador = unidades(dado.quantidade, 4)*unidades(dado.aliquotaReais, 4)
      divisor = BigInt(1000000)
      campos = tag('qBCProd', dado.quantidade)+tag('vAliqProd', dado.aliquotaReais)
      grupo = dado.cst === '03' ? nome+'Qtde' : nome+'Outr'
    } else throw new Error('Modalidade fiscal não suportada.')
    const calculado = (numerador + divisor / BigInt(2)) / divisor
    if (calculado !== valor) throw new Error('Valor do tributo diverge da base e alíquota aprovadas.')
    campos += tag('v'+nome, dado.valor)
  }
  return { xml: '<'+nome+'><'+grupo+'>'+tag('CST', dado.cst)+campos+'</'+grupo+'></'+nome+'>', centavos: valor }
}
