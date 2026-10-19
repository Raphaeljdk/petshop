#!/usr/bin/env node
// Importação segura a partir de um JSON exportado do antigo ERP.
// Não se conecta ao Zetta. Por padrão faz apenas diagnóstico; --apply habilita gravação.
// Ex.: DATABASE_URL=postgresql://... node scripts/importar-zetta-clientes-pets.mjs ./exportacao.json
//      DATABASE_URL=postgresql://... node scripts/importar-zetta-clientes-pets.mjs ./exportacao.json --apply
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'

const db = new PrismaClient()
const aplicar = process.argv.includes('--apply')
const filename = process.argv.slice(2).find((x) => !x.startsWith('--'))
if (!filename) {
  console.error('Uso: node scripts/importar-zetta-clientes-pets.mjs exportacao.json [--apply]')
  process.exit(2)
}
const clean = (x) => String(x ?? '').trim()
const onlyDigits = (x) => clean(x).replace(/\D/g, '')
const external = (x, tipo) => {
  const id = clean(x)
  if (!id || id.length > 90) throw new Error(`ID original inválido (${tipo})`)
  return `zetta:${tipo}:${id}`
}
const readable = (e) => e instanceof Error ? e.message : String(e)
let createdClients = 0, createdPets = 0, existedClients = 0, existedPets = 0
let failed = 0
try {
  const parsed = JSON.parse(await readFile(resolve(filename), 'utf8'))
  if (!Array.isArray(parsed.clientes) || parsed.clientes.length > 10000) throw new Error('Esperado JSON com lista "clientes" de até 10.000 cadastros.')
  const seenClientes = new Set()
  const seenPets = new Set()
  const cleanClients = parsed.clientes.map((c, i) => {
    const id = external(c.codigo, 'cliente')
    if (seenClientes.has(id)) throw new Error(`Cliente duplicado no arquivo: ${id}`)
    seenClientes.add(id)
    const nome = clean(c.nome)
    const telefone = onlyDigits(c.telefone)
    if (!nome || nome.length > 180 || telefone.length < 8 || telefone.length > 15) throw new Error(`Cliente ${id} com nome ou telefone inválido, linha ${i + 1}`)
    const pets = (c.pets || []).map((p) => {
      const pid = external(p.codigo, 'pet')
      if (seenPets.has(pid)) throw new Error(`Pet duplicado no arquivo: ${pid}`)
      seenPets.add(pid)
      if (!clean(p.nome) || !clean(p.especie)) throw new Error(`Pet sem nome ou espécie: ${pid}`)
      return {
        importacaoLegadoId: pid, nome: clean(p.nome), especie: clean(p.especie),
        raca: clean(p.raca) || null, idade: clean(p.idade) || null,
        peso: clean(p.peso) || null, observacoes: clean(p.observacoes) || null,
      }
    })
    const cpfCnpj = onlyDigits(c.cpfCnpj) || null
    const email = clean(c.email).toLowerCase() || null
    if (cpfCnpj && ![11,14].includes(cpfCnpj.length)) throw new Error(`CPF/CNPJ inválido: ${id}`)
    if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160)) throw new Error(`E-mail inválido: ${id}`)
    return {
      id, nome, telefone, cpfCnpj, email,
      endereco: clean(c.endereco) || null, cep: onlyDigits(c.cep) || null, pets,
    }
  })
  const mapa = await db.cliente.findMany({ select: { id: true, nome: true, cpfCnpj: true, email: true, importacaoLegadoId: true } })
  const petsExistentes = await db.pet.findMany({ select: { id: true, nome: true, especie: true, clienteId: true, importacaoLegadoId: true } })
  const porId = new Map(mapa.filter(c => c.importacaoLegadoId).map(c => [c.importacaoLegadoId, c]))
  const porDocumento = new Map(mapa.filter(c => c.cpfCnpj).map(c => [c.cpfCnpj, c]))
  const porEmail = new Map(mapa.filter(c => c.email).map(c => [c.email.toLowerCase(), c]))
  const petPorId = new Map(petsExistentes.filter(p => p.importacaoLegadoId).map(p => [p.importacaoLegadoId, p]))
  const conflicts = []
  for (const c of cleanClients) {
    const found = porId.get(c.id)
    const doc = c.cpfCnpj ? porDocumento.get(c.cpfCnpj) : null
    const email = c.email ? porEmail.get(c.email) : null
    if ((doc && doc.id !== found?.id) || (email && email.id !== found?.id)) {
      conflicts.push(`${c.id}: cadastro local pré-existente por CPF/CNPJ ou e-mail. Rever vínculo manualmente.`)
    }
    if (found) {
      for (const p of c.pets) {
        const old = petPorId.get(p.importacaoLegadoId)
        if (old && old.clienteId !== found.id) conflicts.push(`${p.importacaoLegadoId}: pet vinculado a outro tutor local.`)
        if (!old && petsExistentes.some(x => x.clienteId === found.id && x.nome.toLowerCase() === p.nome.toLowerCase() && x.especie.toLowerCase() === p.especie.toLowerCase())) conflicts.push(`${p.importacaoLegadoId}: pet com mesmo nome/espécie sem vínculo confirmado.`)
      }
    }
  }
  const totalPets = cleanClients.reduce((n,c)=>n+c.pets.length,0)
  console.log(JSON.stringify({ modo: aplicar ? 'aplicacao' : 'simulacao', clientesNoArquivo: cleanClients.length, petsNoArquivo: totalPets, clientesJaImportados: cleanClients.filter(c=>porId.has(c.id)).length, petsJaImportados: [...seenPets].filter(id=>petPorId.has(id)).length, conflitos: conflicts.slice(0,100), conflitosTotal: conflicts.length },null,2))
  if (conflicts.length) throw new Error('Há conflitos. Ajuste os vínculos manualmente antes de importar; nenhuma gravação foi feita.')
  if (!aplicar) { console.log('Simulação concluída: use --apply somente após backup e revisão dos totais.'); process.exitCode = 0 }
  else {
    for (const c of cleanClients) {
      try {
        const changed = await db.$transaction(async tx => {
          const existing = await tx.cliente.findUnique({ where: { importacaoLegadoId: c.id } })
          const cliente = existing || await tx.cliente.create({
            data: { nome: c.nome, telefone: c.telefone, email: c.email, cpfCnpj: c.cpfCnpj, endereco: c.endereco, cep: c.cep, importacaoLegadoId: c.id },
          })
          let petCriados = 0, petRepetidos = 0
          for (const p of c.pets) {
            const old = await tx.pet.findUnique({ where: { importacaoLegadoId: p.importacaoLegadoId } })
            if (old) {
              if (old.clienteId !== cliente.id) throw new Error('ID de pet pertence a outro tutor.')
              petRepetidos++
            } else {
              const duplo = await tx.pet.findFirst({ where: { clienteId: cliente.id, nome: { equals: p.nome, mode: 'insensitive' }, especie: { equals: p.especie, mode: 'insensitive' } } })
              if (duplo) throw new Error('Pet parecido já existe no cadastro local; revise vínculo.')
              await tx.pet.create({ data: { ...p, clienteId: cliente.id } })
              petCriados++
            }
          }
          return { novo: !existing, petCriados, petRepetidos }
        }, { timeout: 30_000 })
        createdClients += Number(changed.novo)
        existedClients += Number(!changed.novo)
        createdPets += changed.petCriados
        existedPets += changed.petRepetidos
      } catch (e) {
        failed++
        console.error(`Falha em ${c.id}: ${readable(e)}`)
      }
    }
    console.log(JSON.stringify({ novosClientes: createdClients, clientesExistentes: existedClients, novosPets: createdPets, petsExistentes: existedPets, falhas: failed },null,2))
    if (failed) throw new Error('Importação parcial: corrija falhas e execute novamente (IDs únicos impedem duplicação).')
  }
} catch (e) {
  console.error('Importação interrompida:', readable(e))
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
