import { describe, expect, test } from 'bun:test'
import { lerPrecosPorRaca, precosPorRacaSchema } from '../src/lib/precos-por-raca'
import {
  CATALOGO_ESTETICO_MATILHA,
  chaveServicoPersonalizado,
  slugServico,
  configuracaoPodeSerConfirmada,
  listarServicosParaConfiguracao,
  catalogoPorRaca, REGRA_PRECO_FIXO,
} from '../src/lib/catalogo-servicos-matilha'

describe('Catálogo estético sem valores fictícios', () => {
  test('cada serviço confirmado pela loja recebe chave única e estável', () => {
    expect(CATALOGO_ESTETICO_MATILHA.length).toBe(11)
    expect(new Set(CATALOGO_ESTETICO_MATILHA.map((s) => s.chave)).size).toBe(11)
    expect(CATALOGO_ESTETICO_MATILHA.find((s) => s.nome === 'Limpeza de ouvidos')?.chave).toBe('limpeza-de-ouvidos')
    expect(CATALOGO_ESTETICO_MATILHA.some((s) => /hospedagem/i.test(s.nome))).toBe(false)
  })

  test('retorna dados pendentes, sem inventar preço ou duração', () => {
    const items = listarServicosParaConfiguracao([])
    expect(items).toHaveLength(11)
    for (const item of items) {
      expect(item.precoCentavos).toBeNull()
      expect(item.precosPorRaca).toEqual([])
      expect(item.duracaoMinutos).toBeNull()
      expect(item.regrasPreco).toBeNull()
      expect(item.confirmado).toBe(false)
      expect(item.updatedAt).toBeNull()
    }
  })

  test('retorna só o item alterado, sem sobrescrever os demais', () => {
    const dados = listarServicosParaConfiguracao([{
      chave: 'banho', precoCentavos: 7500,
      precosPorRaca: [
        { raca: 'Golden Retriever', precoCentavos: 15000 },
        { raca: 'Poodle', precoCentavos: 9000 },
      ],
      duracaoMinutos: 60,
      regrasPreco: 'Preço varia por porte', observacoes: null,
      confirmado: true, updatedAt: '2026-11-02T00:00:00.000Z',
    }])
    expect(dados.find((s) => s.chave === 'banho')?.precoCentavos).toBe(7500)
    expect(dados.find((s) => s.chave === 'banho')?.precosPorRaca).toHaveLength(2)
    expect(dados.find((s) => s.chave === 'tosa-modalidade-a-definir')?.precosPorRaca).toEqual([])
    expect(dados.find((s) => s.chave === 'tosa-modalidade-a-definir')?.precoCentavos).toBeNull()
  })

  test('gera chave estável para serviços personalizados e normaliza acentos', () => {
    expect(slugServico('Banho terapêutico')).toBe('banho-terapeutico')
    expect(chaveServicoPersonalizado(' Banho Terapêutico ')).toBe('personalizado-banho-terapeutico')
    expect(chaveServicoPersonalizado('banho   TERAPÊUTICO')).toBe('personalizado-banho-terapeutico')
  })

  test('lista novos serviços persistidos sem perder os nove serviços padrão', () => {
    const item = {
      chave: chaveServicoPersonalizado('Banho terapêutico'),
      nome: 'Banho terapêutico',
      precoCentavos: 12500,
      precosPorRaca: [{ raca: 'Golden Retriever', precoCentavos: 15500 }],
      duracaoMinutos: 90, regrasPreco: null, observacoes: 'Produto especial',
      confirmado: true, updatedAt: '2026-11-20T00:00:00.000Z',
    }
    const itens = listarServicosParaConfiguracao([item])
    expect(itens).toHaveLength(12)
    expect(itens[0].nome).toBe('Banho')
    expect(itens[11]).toMatchObject({
      chave: 'personalizado-banho-terapeutico',
      nome: 'Banho terapêutico',
      precoCentavos: 12500,
      duracaoMinutos: 90,
      confirmado: true,
    })
    expect(itens[11].precosPorRaca).toEqual([{ raca: 'Golden Retriever', precoCentavos: 15500 }])
    expect(itens.find(x => x.chave === 'banho')?.precoCentavos).toBeNull()
  })

  test('não mostra registro não cadastrado como serviço personalizado', () => {
    const items = listarServicosParaConfiguracao([{
      chave: 'arbitrario', nome: 'Falso serviço',
      precoCentavos: null, precosPorRaca: [],
      duracaoMinutos: null, regrasPreco: null, observacoes: null,
      confirmado: false, updatedAt: null,
    }])
    expect(items).toHaveLength(11)
  })

  test('não permite confirmar sem duração e sem regra/preço', () => {
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: null, regrasPreco: null,
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 60, regrasPreco: null,
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 60, regrasPreco: '   ',
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: 0, duracaoMinutos: 60, regrasPreco: null,
    })).toBe(true)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 45, regrasPreco: 'Preço por porte',
    })).toBe(true)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 45, regrasPreco: null,
      precosPorRaca: [{ raca: 'Golden Retriever', precoCentavos: 15000 }],
    })).toBe(true)
  })

  test('permite várias raças e valores, sem sobrescrever preço de referência', () => {
    const valores = precosPorRacaSchema.parse([
      { raca: 'Golden Retriever', precoCentavos: 15000 },
      { raca: 'Shih Tzu', precoCentavos: 9500 },
    ])
    expect(valores).toHaveLength(2)
    expect(valores[0].precoCentavos).toBe(15000)
    expect(valores[1].precoCentavos).toBe(9500)
  })

  test('recusa raça duplicada mesmo com diferença de acento, espaço ou caixa', () => {
    const validacao = precosPorRacaSchema.safeParse([
      { raca: 'Poodle', precoCentavos: 10000 },
      { raca: '  pOODLE  ', precoCentavos: 12000 },
    ])
    expect(validacao.success).toBe(false)
    if (!validacao.success) expect(validacao.error.issues[0]?.message).toContain('já está cadastrada')
  })

  test('recusa valores inválidos e não inventa preços para entradas ausentes', () => {
    expect(precosPorRacaSchema.safeParse([{ raca: 'Poodle', precoCentavos: -100 }]).success).toBe(false)
    expect(precosPorRacaSchema.safeParse([{ raca: '', precoCentavos: 10000 }]).success).toBe(false)
    expect(precosPorRacaSchema.safeParse([{ raca: 'Poodle', precoCentavos: 100.5 }]).success).toBe(false)
    expect(lerPrecosPorRaca(null)).toEqual([])
  })
})

describe('Catálogo público por raça e preço único',()=>{
  const banho={chave:'banho',precoCentavos:15000,duracaoMinutos:120,regrasPreco:REGRA_PRECO_FIXO,observacoes:null,confirmado:true,updatedAt:null}
  test('preço igual em diferentes raças e sem necessidade de grupo',()=>{
    for(const raca of ['Husky Siberiano','Pit Bull Terrier','Chihuahua']){
      expect(catalogoPorRaca([banho],raca).opcoes.find(s=>s.chave==='banho')).toMatchObject({precoCentavos:15000,duracaoMinutos:120})
    }
  })
  test('não oferece preço não confirmado nem pet sem raça',()=>{
    expect(catalogoPorRaca([{...banho,confirmado:false}],'Husky Siberiano').opcoes).toHaveLength(0)
    expect(catalogoPorRaca([{...banho,regrasPreco:null}],'Husky Siberiano').opcoes).toHaveLength(0)
    expect(catalogoPorRaca([banho],null).opcoes).toHaveLength(0)
    expect(catalogoPorRaca([{...banho,confirmado:false}],'Husky Siberiano').pendentes.some(s=>s.chave==='banho')).toBe(true)
  })
  test('serviço por porte continua restrito à raça e preserva o preço por raça anterior confirmado',()=>{
    const item={...banho,chave:'banho-e-tosa',regrasPreco:null,precosPorRaca:[{raca:'Husky Siberiano',precoCentavos:45000}]}
    expect(catalogoPorRaca([item],' HUSKY siberiano ').opcoes.find(s=>s.chave===item.chave)?.precoCentavos).toBe(45000)
    expect(catalogoPorRaca([item],'Poodle').opcoes).toHaveLength(0)
  })
})
