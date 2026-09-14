import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const DEV_SECRET = 'matilha-prado-secret-apenas-desenvolvimento'

function getSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET deve ser configurado em produção')
  }
  return process.env.NEXTAUTH_SECRET || DEV_SECRET
}
export const COOKIE_NAME = 'matilha_token'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 dias em segundos

export interface TokenPayload {
  userId: string
  email: string
  nome: string
  role: 'ADMIN' | 'CLIENTE'
  clienteId?: string | null
}

export interface UsuarioLogado {
  id: string
  nome: string
  email: string
  role: 'ADMIN' | 'CLIENTE'
  clienteId: string | null
  cliente: {
    id: string
    nome: string
    telefone: string
    email: string | null
    endereco: string | null
    cep: string | null
    pets?: any[]
  } | null
}

export async function criarToken(user: {
  id: string
  nome: string
  email: string
  role: string
  clienteId?: string | null
}): Promise<string> {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role as 'ADMIN' | 'CLIENTE',
    clienteId: user.clienteId ?? null,
  }
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' })
}

export async function setCookieAuth(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export async function removerCookieAuth(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getUsuarioLogado(): Promise<UsuarioLogado | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const decoded = jwt.verify(token, getSecret()) as TokenPayload
    if (!decoded || !decoded.userId) return null

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: {
        cliente: {
          include: { pets: true },
        },
      },
    })

    if (!user || !user.ativo) return null

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role as 'ADMIN' | 'CLIENTE',
      clienteId: user.clienteId,
      cliente: user.cliente
        ? {
            id: user.cliente.id,
            nome: user.cliente.nome,
            telefone: user.cliente.telefone,
            email: user.cliente.email,
            endereco: user.cliente.endereco,
            cep: user.cliente.cep,
            pets: user.cliente.pets,
          }
        : null,
    }
  } catch (e) {
    console.error('getUsuarioLogado erro:', e)
    return null
  }
}

export async function getClienteLogado(): Promise<{
  id: string
  nome: string
  telefone: string
  email: string | null
  endereco: string | null
  cep: string | null
  pets: any[]
} | null> {
  const usuario = await getUsuarioLogado()
  if (!usuario || !usuario.cliente) return null
  return {
    id: usuario.cliente.id,
    nome: usuario.cliente.nome,
    telefone: usuario.cliente.telefone,
    email: usuario.cliente.email,
    endereco: usuario.cliente.endereco,
    cep: usuario.cliente.cep,
    pets: usuario.cliente.pets || [],
  }
}

export async function isAdmin(): Promise<boolean> {
  const usuario = await getUsuarioLogado()
  return usuario?.role === 'ADMIN'
}

export { bcrypt }
