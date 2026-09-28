'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { toast } from 'sonner'

export type Preference = {
  id: string
  produtoId: string
  favorite: boolean
  restock: boolean
  reminderAt: string | null
  available: boolean | null
  product: { id: string; nome: string; imageUrl: string | null; ativo: boolean }
}
type Change = {
  produtoId: string
  favorite?: boolean
  restock?: boolean
  reminderAt?: string | null
}

export async function portalRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Não foi possível concluir.')
  return data
}

const ExperienceContext = createContext<{
  preferences: Preference[]
  ready: boolean
  loading: boolean
  busy: boolean
  update: (change: Change) => Promise<boolean>
  refresh: () => Promise<void>
} | null>(null)

export function ExperienceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(
    () =>
      portalRequest<Preference[]>('/api/cliente/preferencias')
        .then((rows) => {
          setPreferences(rows)
          setReady(true)
        })
        .catch(() => setReady(false))
        .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 60000)
    return () => clearInterval(timer)
  }, [refresh])
  async function update(change: Change) {
    if (busy) return false
    setBusy(true)
    try {
      await portalRequest('/api/cliente/preferencias', {
        method: 'PUT',
        body: JSON.stringify(change),
      })
      await refresh()
      return true
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <ExperienceContext.Provider
      value={{ preferences, ready, loading, busy, update, refresh }}
    >
      {children}
    </ExperienceContext.Provider>
  )
}

export function useExperience() {
  const context = useContext(ExperienceContext)
  if (!context) throw new Error('ExperienceProvider ausente')
  return context
}
