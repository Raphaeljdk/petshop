import { describe, expect, test } from 'bun:test'
import { artigoDeDiario, podeExibirDiarioNoBlog } from '../src/lib/portal-pet-blog'

const diario = {
  id:'m-1',kind:'diario',title:'Meu primeiro banho',notes:'O dia foi especial!',
  imageData:'data:image/png;base64,aGVsbG8=',createdAt:new Date('2026-11-17T10:00:00Z'),
  eventAt:new Date('2026-11-16T10:00:00Z'),
  createdByAdmin:false,blogConsentAt:new Date('2026-11-17T11:00:00Z'),blogStatus:'publicado',
}

describe('Autorização de diário no blog',()=>{
  test('privado sem aceite nunca é publicado',()=>{
    expect(podeExibirDiarioNoBlog({...diario,blogConsentAt:null})).toBe(false)
    expect(artigoDeDiario({...diario,blogConsentAt:null})).toBeNull()
    expect(artigoDeDiario({...diario,blogStatus:'pendente'})).toBeNull()
    expect(artigoDeDiario({...diario,blogStatus:'revogado'})).toBeNull()
  })
  test('não publica comprovante de vacina nem foto administrativa',()=>{
    expect(artigoDeDiario({...diario,kind:'vacina_documento'})).toBeNull()
    expect(artigoDeDiario({...diario,kind:'banho_depois',createdByAdmin:true})).toBeNull()
    expect(artigoDeDiario({...diario,createdByAdmin:true})).toBeNull()
  })
  test('relato aprovado expõe apenas campos públicos consentidos, sem peso ou dados pessoais',()=>{
    const comCamposPrivados={...diario,weightKg:15,clienteId:'private-user',petKey:'private-pet'}
    const article=artigoDeDiario(comCamposPrivados)
    expect(article?.title).toBe('Meu primeiro banho')
    expect(article?.body).toBe('O dia foi especial!')
    expect(article?.imageUrl).toBe(diario.imageData)
    expect(article?.isPetStory).toBe(true)
    expect(article).not.toHaveProperty('weightKg')
    expect(article).not.toHaveProperty('clienteId')
    expect(article).not.toHaveProperty('petKey')
  })
})
