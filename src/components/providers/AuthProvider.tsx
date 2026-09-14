'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

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

interface AuthContextValue {
  sessao: SessaoUser
  loading: boolean
  refresh: () => Promise<SessaoUser>
  login: (email: string, senha: string) => Promise<boolean>
  cadastrar: (dados: {
    nome: string
    email: string
    senha: string
    telefone: string
    endereco?: string
    cep?: string
  }) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSAO_INICIAL: SessaoUser = { autenticado: false }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<SessaoUser>(SESSAO_INICIAL)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<SessaoUser> => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) {
        setSessao(SESSAO_INICIAL)
        return SESSAO_INICIAL
      }
      const data = await res.json()
      if (data?.autenticado && data.user) {
        const user: UserLogado = {
          id: data.user.id,
          nome: data.user.nome,
          email: data.user.email,
          role: data.user.role,
          clienteId: data.user.clienteId ?? null,
        }
        const novaSessao: SessaoUser = {
          autenticado: true,
          user,
          cliente: data.cliente ?? null,
        }
        setSessao(novaSessao)
        return novaSessao
      }
      setSessao(SESSAO_INICIAL)
      return SESSAO_INICIAL
    } catch {
      setSessao(SESSAO_INICIAL)
      return SESSAO_INICIAL
    }
  }, [])

  const login = useCallback(
    async (email: string, senha: string): Promise<boolean> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, senha }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Credenciais inválidas')
      }
      const data = await res.json()
      if (!data?.success) {
        throw new Error(data?.error || 'Falha no login')
      }
      await refresh()
      return true
    },
    [refresh]
  )

  const cadastrar = useCallback(
    async (dados: {
      nome: string
      email: string
      senha: string
      telefone: string
      endereco?: string
      cep?: string
    }): Promise<boolean> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(dados),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Falha no cadastro')
      }
      const data = await res.json()
      if (!data?.success) {
        throw new Error(data?.error || 'Falha no cadastro')
      }
      await refresh()
      return true
    },
    [refresh]
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // ignore
    }
    await refresh()
  }, [refresh])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await refresh()
      if (mounted) setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [refresh])

  const value: AuthContextValue = {
    sessao,
    loading,
    refresh,
    login,
    cadastrar,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return ctx
}
