'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hook para gerenciar o histórico de navegação entre "tabs" internas.
 * Permite que o botão "Voltar" do navegador funcione para navegar entre seções
 * (ex: Dashboard → Kanban → Agendamentos), em vez de ficar na mesma página.
 *
 * Uso:
 *   const { tab, setTab } = useTabHistory<TabId>('dashboard')
 *
 * - setTab(novaTab): muda de tab e empilha no histórico
 * - Botão Voltar do navegador: volta para a tab anterior
 */
export function useTabHistory<T extends string>(initial: T) {
  const [tab, setTabState] = useState<T>(initial)
  const initialized = useRef(false)
  const internalNav = useRef(false)

  // Inicializa: se já houver hash na URL, usa ele
  useEffect(() => {
    if (!initialized.current) {
      const hash = window.location.hash.replace('#', '') as T
      if (hash) {
        // Pequeno atraso para evitar cascading render
        const t = setTimeout(() => setTabState(hash), 0)
        initialized.current = true
        return () => clearTimeout(t)
      } else {
        // Adiciona tab inicial ao histórico
        window.history.replaceState({ tab: initial }, '', `#${initial}`)
      }
      initialized.current = true
    }
  }, [initial])

  // Listener para popstate (botão voltar/avançar do navegador)
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const stateTab = e.state?.tab as T | undefined
      if (stateTab) {
        internalNav.current = true
        setTabState(stateTab)
      } else {
        // Sem state - volta para a inicial
        const hash = window.location.hash.replace('#', '') as T
        if (hash) {
          internalNav.current = true
          setTabState(hash)
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Função para mudar de tab (empilha no histórico)
  const setTab = (novaTab: T) => {
    if (tab === novaTab) return
    setTabState(novaTab)
    if (!internalNav.current) {
      // Navegação manual do usuário - empilha no histórico
      window.history.pushState({ tab: novaTab }, '', `#${novaTab}`)
    }
    internalNav.current = false
  }

  return { tab, setTab }
}
