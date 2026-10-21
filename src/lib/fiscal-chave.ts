/** A chave de acesso contém identificação e DV, mas não prova autorização da SEFAZ. */
export function calcularDVChaveNfe(base43: string): string {
  if (!/^\d{43}$/.test(base43)) throw new Error('Base da chave fiscal inválida.')
  let weight = 2
  let sum = 0
  for (let i = 42; i >= 0; i--) {
    sum += Number(base43[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const dv = 11 - (sum % 11)
  return String(dv >= 10 ? 0 : dv)
}

export function interpretarChaveNfe(chave: string, cnpjEmitente: string) {
  const key = chave.replace(/\s/g, '')
  const cnpj = cnpjEmitente.replace(/\D/g, '')
  if (!/^\d{44}$/.test(key)) throw new Error('A chave de acesso deve conter exatamente 44 dígitos.')
  if (calcularDVChaveNfe(key.slice(0, 43)) !== key[43])
    throw new Error('Dígito verificador da chave de acesso inválido.')
  if (!/^\d{14}$/.test(cnpj) || key.slice(6, 20) !== cnpj)
    throw new Error('A chave fiscal pertence a outro CNPJ, diferente do emitente cadastrado.')
  const modelo = key.slice(20, 22)
  if (!['55','65'].includes(modelo))
    throw new Error('Documento informado não é uma NF-e 55 nem NFC-e 65.')
  const serie = Number(key.slice(22, 25))
  const numero = Number(key.slice(25, 34))
  if (!Number.isInteger(numero) || numero <= 0 || !Number.isInteger(serie) || serie <= 0)
    throw new Error('Série ou número da nota fiscal inválidos.')
  return { chaveAcesso:key, modelo, numero, serie, cnpj }
}
