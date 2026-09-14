import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { criarToken, setCookieAuth } from '@/lib/auth-cookies'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, senha, telefone, endereco, cep } = body

    if (!nome || !email || !senha || !telefone) {
      return NextResponse.json(
        { success: false, error: 'Nome, email, senha e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    const emailNormalizado = String(email).toLowerCase().trim()

    const existente = await db.user.findUnique({
      where: { email: emailNormalizado },
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Email já cadastrado' },
        { status: 409 }
      )
    }

    const clienteExistente = await db.cliente.findUnique({
      where: { email: emailNormalizado },
    })

    const senhaHash = await bcrypt.hash(String(senha), 10)

    const result = await db.$transaction(async (tx) => {
      const cliente = clienteExistente
        ? await tx.cliente.update({
            where: { id: clienteExistente.id },
            data: {
              nome,
              telefone: String(telefone),
              endereco: endereco || null,
              cep: cep || null,
            },
          })
        : await tx.cliente.create({
            data: {
              nome,
              telefone: String(telefone),
              email: emailNormalizado,
              endereco: endereco || null,
              cep: cep || null,
            },
          })

      const user = await tx.user.create({
        data: {
          nome,
          email: emailNormalizado,
          senha: senhaHash,
          role: 'CLIENTE',
          clienteId: cliente.id,
        },
        include: { cliente: true },
      })

      return user
    })

    const token = await criarToken({
      id: result.id,
      nome: result.nome,
      email: result.email,
      role: result.role,
      clienteId: result.clienteId,
    })

    await setCookieAuth(token)

    return NextResponse.json({
      success: true,
      user: {
        id: result.id,
        nome: result.nome,
        email: result.email,
        role: result.role,
        clienteId: result.clienteId,
        cliente: result.cliente,
      },
    })
  } catch (e) {
    console.error('register erro:', e)
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar usuário' },
      { status: 500 }
    )
  }
}
