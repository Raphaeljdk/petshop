'use client'
import { useEffect, useState } from 'react'
export function useStoreFeed<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const json: T = await r.json()
        if (active) {
          setData(json)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (active) setStatus('error')
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [url, attempt])
  return {
    data,
    status,
    retry: () => {
      setStatus('loading')
      setAttempt((n) => n + 1)
    },
  }
}
