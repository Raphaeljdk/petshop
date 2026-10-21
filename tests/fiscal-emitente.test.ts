import { describe, expect, test } from 'bun:test'
import { camposEditaveisEmitente, configSchema, erroConfigEmitente } from '../src/lib/fiscal-emitente'

const emitente = {
  razaoSocial: 'Empresa Exemplo LTDA', nomeFantasia: 'Pet Shop',
  cnpj: '12345678000195', inscricaoEstadual: '123456789',
  regimeTributario: '1' as const, logradouro: 'Avenida Principal', numeroEndereco: '1647',
  bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '02333001',
  codigoMunicipio: '3550308', serieNfe: 1, ambiente: 'homologacao' as const,
}
describe('Cadastro fiscal não envia metadados internos', () => {
  test('limpa id e timestamps que causavam HTTP 400 ao salvar', () => {
    const recebidoDoBanco={...emitente,id:'config',createdAt:'2026-10-19T12:00:00Z',updatedAt:'2026-10-20T12:00:00Z'}
    expect(configSchema.safeParse(recebidoDoBanco).success).toBe(false)
    const formulario=camposEditaveisEmitente(recebidoDoBanco)
    expect(configSchema.safeParse(formulario).success).toBe(true)
    expect('id' in formulario).toBe(false)
    expect('createdAt' in formulario).toBe(false)
    expect('updatedAt' in formulario).toBe(false)
    expect(formulario.codigoMunicipio).toBe('3550308')
  })
  test('preserva ambiente escolhido e valores de preenchimento ao salvar', () => {
    const p=camposEditaveisEmitente({...emitente,ambiente:'producao'})
    expect(configSchema.parse(p).ambiente).toBe('producao')
    expect(p.regimeTributario).toBe('1')
  })
  test('mensagem de erro aponta o campo inválido', () => {
    const parsed=configSchema.safeParse({...emitente,serieNfe:0})
    if(parsed.success)throw new Error('Teste inválido')
    expect(erroConfigEmitente(parsed.error)).toContain('Série de NF-e')
  })
  test('validação estrita do servidor continua protegendo contra mass assignment', () => {
    const parsed=configSchema.safeParse({...emitente,id:'abc',role:'ADMIN'})
    expect(parsed.success).toBe(false)
    if(!parsed.success)expect(erroConfigEmitente(parsed.error)).toContain('campos internos')
  })
})
