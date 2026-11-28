'use client'
import { useEffect, useRef } from 'react'
/** Static by default. Visibility, user preference and constrained devices gate every animation. */
export function useStoreMotion<T extends HTMLElement>(paused: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const device = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    const constrained = Boolean(
      device.connection?.saveData ||
      (device.deviceMemory && device.deviceMemory <= 2) ||
      (device.hardwareConcurrency && device.hardwareConcurrency <= 2),
    )
    let visible = false
    const sync = () => {
      el.dataset.motion = String(
        !paused && !reduce.matches && !constrained && visible && !document.hidden,
      )
      el.dataset.static = String(constrained || reduce.matches)
    }
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            sync()
          })
        : null
    observer?.observe(el)
    reduce.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      observer?.disconnect()
      reduce.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [paused])
  return ref
}
