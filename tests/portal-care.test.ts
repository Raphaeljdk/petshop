import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recommendationRank, imageData } from '../src/lib/portal-care-rules'

test('recomendações consideram espécie, porte e idade sem indicar ração', () => {
  const pet = recommendationRank('Brinquedo para cachorro filhote pequeno', 'Brinquedos', 'cachorro', 'pequeno', 0)
  const estranho = recommendationRank('Acessório para gatos grandes', 'Acessórios', 'cachorro', 'pequeno', 0)
  assert.ok(pet > estranho)
  const idoso = recommendationRank('Mordedor sênior cachorro', 'Brinquedos', 'cachorro', 'médio', 10)
  const adulto = recommendationRank('Mordedor sênior cachorro', 'Brinquedos', 'cachorro', 'médio', 3)
  assert.ok(idoso > adulto)
  assert.ok(recommendationRank('Ração veterinária', 'Alimentos', 'cachorro', 'médio') < 0)
})

test('fotos particulares aceitam só imagens de tamanho controlado', () => {
  assert.equal(imageData.safeParse('data:image/jpeg;base64,AA==').success,true)
  assert.equal(imageData.safeParse('data:application/pdf;base64,AA==').success,false)
  assert.equal(imageData.safeParse('https://example.com/photo.png').success,false)
  assert.equal(imageData.safeParse('data:image/svg+xml;base64,AA==').success,false)
  assert.equal(imageData.safeParse('data:image/png;base64,'+'A'.repeat(220001)).success,false)
})
