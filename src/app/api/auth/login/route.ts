import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { criarToken, setCookieAuth, bcrypt } from '@/lib/auth-cookies'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, senha } = body

    if (!email || !senha) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { cliente: true },
    })

    if (!user || !user.ativo) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const senhaValida = await bcrypt.compare(senha, user.senha)
    if (!senhaValida) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const token = await criarToken({
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      clienteId: user.clienteId,
    })

    await setCookieAuth(token)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        clienteId: user.clienteId,
        cliente: user.cliente,
      },
    })
  } catch (e) {
    console.error('login erro:', e)
    return NextResponse.json(
      { success: false, error: 'Erro interno no login' },
      { status: 500 }
    )
  }
}
