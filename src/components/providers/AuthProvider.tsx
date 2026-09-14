'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface UserLogado {
  id: string
  nome: string
  email: string
  role: 'ADMIN' | 'CLIENTE'
  clienteId?: string | null
}
export interface ClienteSessao {
  id: string
  nome: string
  telefone: string
  email: string | null
  endereco: string | null
  cep: string | null
  pets?: any[]
}
export interface SessaoUser {
  autenticado: boolean
  user?: UserLogado
  cliente?: ClienteSessao | null
}
export interface CadastroDados {
  nome: string
  email: string
  senha: string
  confirmarSenha: string
  role: 'ADMIN' | 'CLIENTE'
  telefone?: string
  endereco?: string
  cep?: string
  convite?: string
}
export class AuthRequestError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}) { super(message) }
}
interface AuthContextValue {
  sessao: SessaoUser
  loading: boolean
  refresh: () => Promise<SessaoUser>
  login: (email: string, senha: string, lembrar?: boolean) => Promise<boolean>
  cadastrar: (dados: CadastroDados) => Promise<boolean>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)
const SESSAO_INICIAL: SessaoUser = { autenticado: false }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<SessaoUser>(SESSAO_INICIAL)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<SessaoUser> => {
    const data = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null)
    if (data?.autenticado && data.user && ['ADMIN', 'CLIENTE'].includes(data.user.role)) {
      const novaSessao: SessaoUser = {
        autenticado: true,
        user: { id: data.user.id, nome: data.user.nome, email: data.user.email, role: data.user.role, clienteId: data.user.clienteId ?? null },
        cliente: data.cliente ?? null,
      }
      setSessao(novaSessao)
      return novaSessao
    }
    setSessao(SESSAO_INICIAL)
    return SESSAO_INICIAL
  }, [])

  const authenticate = useCallback(async (url: string, data: unknown, registration = false) => {
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
    } catch {
      throw new AuthRequestError('Não foi possível conectar. Confira sua internet e tente novamente.')
    }
    const result = await res.json().catch(() => null)
    if (!res.ok || !result?.success) {
      throw new AuthRequestError(result?.error || 'Não foi possível concluir agora. Tente novamente.', result?.fields)
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    const current = await refresh()
    if (!current.autenticado) {
      throw new AuthRequestError(registration
        ? 'Conta criada. Entre com seu e-mail e senha para continuar.'
        : 'Não foi possível confirmar sua sessão. Permita cookies neste site e tente novamente.')
    }
    return true
  }, [refresh])

  const login = useCallback((email: string, senha: string, lembrar = false) =>
    authenticate('/api/auth/login', { email, senha, lembrar }), [authenticate])
  const cadastrar = useCallback((dados: CadastroDados) =>
    authenticate(dados.role === 'ADMIN' ? '/api/auth/register/admin' : '/api/auth/register', dados, true), [authenticate])

  const logout = useCallback(async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    if (!res.ok) throw new AuthRequestError('Não foi possível sair. Tente novamente.')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setSessao(SESSAO_INICIAL)
  }, [])

  useEffect(() => {
    let mounted = true
    void refresh().finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [refresh])

  return <AuthContext.Provider value={{ sessao, loading, refresh, login, cadastrar, logout }}>{children}</AuthContext.Provider>
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  return ctx
}
