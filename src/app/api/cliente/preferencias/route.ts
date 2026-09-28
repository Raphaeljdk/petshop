import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import {
  experienceBody,
  experienceError,
  preferenceInput,
  preferencesFor,
} from '@/lib/customer-experience'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(await preferencesFor(cliente.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return experienceError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { produtoId, ...data } = preferenceInput.parse(
      await experienceBody(req),
    )
    if (
      data.reminderAt &&
      (new Date(data.reminderAt).getTime() <= Date.now() ||
        new Date(data.reminderAt).getTime() > Date.now() + 366 * 86400000)
    )
      return NextResponse.json(
        { error: 'Escolha uma data futura dentro de um ano.' },
        { status: 400 },
      )
    if (!(await db.produto.findUnique({ where: { id: produtoId } })))
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 },
      )
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cliente.id}))`
      const existing = await tx.customerPreference.findUnique({
        where: { clienteId_produtoId: { clienteId: cliente.id, produtoId } },
      })
      if (
        !existing &&
        (await tx.customerPreference.count({
          where: { clienteId: cliente.id },
        })) >= 200
      )
        return null
      if (
        data.restock &&
        !existing?.restock &&
        (await tx.customerPreference.count({
          where: { clienteId: cliente.id, restock: true },
        })) >= 20
      )
        return null
      const row = await tx.customerPreference.upsert({
        where: { clienteId_produtoId: { clienteId: cliente.id, produtoId } },
        create: { clienteId: cliente.id, produtoId, ...data },
        update: data,
      })
      if (!row.favorite && !row.restock && !row.reminderAt)
        await tx.customerPreference.delete({ where: { id: row.id } })
      return row
    })
    if (!result)
      return NextResponse.json(
        {
          error:
            'Limite de 200 produtos salvos ou 20 avisos de estoque. Remova um para adicionar outro.',
        },
        { status: 400 },
      )
    return NextResponse.json(result)
  } catch (error) {
    return experienceError(error)
  }
}
