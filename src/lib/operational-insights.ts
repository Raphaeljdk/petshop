import { codigoCompartilhado } from './product-sku-groups'
import { getProductBrand, SEM_MARCA } from './product-brands'

/**
 * Diagnóstico de leitura. Não concilia saldos automaticamente, não altera
 * anúncios e não confunde anúncios vinculados com produtos duplicados reais.
 */
export type ProdutoOperacional = {
  id: string; nome: string; descricao: string | null; categoria: string
  sku: string | null; imageUrl: string | null; preco: number
  estoque: number; estoqueHub: number; estoqueZetta: number
  estoqueMercadoLivre: number; estoqueAmazon: number
  estoqueIlimitado: boolean; zettaProCod: number | null
  mlItemId: string | null; amazonAsin: string | null
  ativo: boolean
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function diagnosticarCatalogo(produtos: ProdutoOperacional[]) {
  const ativos = produtos.filter((produto) => produto.ativo)
  const semFoto = ativos.filter((p) => !p.imageUrl?.trim())
  const semMarca = ativos.filter((p) => getProductBrand(p) === SEM_MARCA)
  const incompletos = ativos.filter((p) =>
    !p.nome.trim() || !p.categoria.trim() || !Number.isFinite(p.preco) || p.preco <= 0)
  const grupos = new Map<string, ProdutoOperacional[]>()
  for (const produto of ativos) {
    const sku = codigoCompartilhado(produto.sku)
    const nome = normalizar(produto.nome)
    if (!sku || !nome) continue
    // SKU e nome físico iguais: possível anúncio espelhado, NÃO exclusão automática.
    const chave = sku + ':' + nome
    grupos.set(chave, [...(grupos.get(chave) || []), produto])
  }
  const relacionados = [...grupos.values()].filter((grupo) => grupo.length > 1)
  const divergencias = ativos.flatMap((produto) => {
    if (produto.estoqueIlimitado) return []
    const saldos = [
      ...(produto.zettaProCod != null ? [{ canal: 'Zetta', saldo: produto.estoqueZetta }] : []),
      ...(produto.mlItemId ? [{ canal: 'Mercado Livre', saldo: produto.estoqueMercadoLivre }] : []),
      ...(produto.amazonAsin ? [{ canal: 'Amazon', saldo: produto.estoqueAmazon }] : []),
    ]
    // Com somente uma fonte não há como comparar; 0 é um saldo válido.
    if (saldos.length < 2 || new Set(saldos.map((x) => x.saldo)).size === 1) return []
    return [{ id: produto.id, nome: produto.nome, sku: produto.sku, saldos }]
  })
  return {
    total: ativos.length,
    semFoto: semFoto.length,
    semMarca: semMarca.length,
    incompletos: incompletos.length,
    gruposRelacionados: relacionados.length,
    saldosDiferentes: divergencias.length,
    exemplosSemFoto: semFoto.slice(0, 4).map(({ id, nome, sku }) => ({ id, nome, sku })),
    exemplosIncompletos: incompletos.slice(0, 4).map(({ id, nome, sku }) => ({ id, nome, sku })),
    exemplosDivergencias: divergencias.slice(0, 5),
    marcas: [...new Set(ativos.map(getProductBrand))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }
}

export type AgendamentoConflito = {
  id: string; dataHora: Date; profissionalId: string | null
  status: string; pet: { nome: string }
}

/** Sem duração no cadastro: detecta apenas mesmo horário exato do profissional. */
export function identificarChoquesAgenda(agendamentos: AgendamentoConflito[]) {
  const usados = new Map<string, AgendamentoConflito>()
  const conflitos: Array<{ id: string; outroId: string; dataHora: string; profissionalId: string; pets: string[] }> = []
  for (const item of agendamentos) {
    if (!item.profissionalId || !['agendado', 'confirmado'].includes(item.status)) continue
    const chave = item.profissionalId + ':' + item.dataHora.toISOString()
    const anterior = usados.get(chave)
    if (anterior) conflitos.push({
      id: item.id, outroId: anterior.id, dataHora: item.dataHora.toISOString(),
      profissionalId: item.profissionalId, pets: [anterior.pet.nome, item.pet.nome],
    })
    else usados.set(chave, item)
  }
  return conflitos
}

export type DadosMargem = {
  receita: number; custoProdutos: number; taxasMarketplace: number
  freteOperacao: number; impostos: number; outrosCustos: number
}

/** Calcula margem somente quando TODOS os valores foram explicitamente preenchidos. */
export function calcularMargem(dados: DadosMargem | null) {
  if (!dados || Object.values(dados).some((valor) => !Number.isFinite(valor) || valor < 0))
    return null
  const lucro = Math.round((dados.receita - dados.custoProdutos - dados.taxasMarketplace -
    dados.freteOperacao - dados.impostos - dados.outrosCustos) * 100) / 100
  const margemPercentual = dados.receita > 0 ? Math.round(lucro / dados.receita * 10000) / 100 : null
  return { lucro, margemPercentual }
}
