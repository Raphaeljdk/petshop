'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, RotateCcw } from 'lucide-react'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import {
  HELP_SIZE, encaixarAjuda, lerAjudaSalva, limitesAjuda, limitarAjuda, posicionarAjuda,
  type HelpPosition, type HelpSavedPosition,
} from '@/lib/mobile-whatsapp-position'

const STORAGE_KEY = 'matilha-whatsapp-mobile-position-v1'
const DEFAULT_LINK = matilhaWhatsAppUrl('Olá! Estou no portal da Matilha Prado e preciso de ajuda.')

type Drag = {
  pointerId: number
  startX: number
  startY: number
  original: HelpPosition
  dragged: boolean
}

function viewportBounds() {
  // Usa a borda superior real da navegação fixa, mesmo se houver duas linhas de abas.
  const nav = document.querySelector<HTMLElement>('.mp-bottom, .client-portal .portal-tabs')
  const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight - 80
  return limitesAjuda(window.innerWidth, Math.min(window.innerHeight, navTop))
}

function save(side: HelpSavedPosition | null) {
  try {
    if (side) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(side))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Em navegação privada/bloqueio de armazenamento, o balão continua funcional.
  }
}

export function DraggableWhatsAppHelp({publicStore=false}:{publicStore?:boolean}={}) {
  const [position, setPosition] = useState<HelpPosition | null>(null)
  const [side, setSide] = useState<HelpSavedPosition['side']>('right')
  const [customized, setCustomized] = useState(false)
  const positionRef = useRef<HelpPosition | null>(null)
  const savedRef = useRef<HelpSavedPosition | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const ignoreClickRef = useRef(false)

  function updatePosition(next: HelpPosition) {
    positionRef.current = next
    setPosition(next)
  }

  useEffect(() => {
    let saved: HelpSavedPosition | null = null
    try { saved = lerAjudaSalva(window.localStorage.getItem(STORAGE_KEY)) } catch {}
    savedRef.current = saved
    setSide(saved?.side ?? 'right')
    setCustomized(Boolean(saved))
    updatePosition(posicionarAjuda(saved, viewportBounds()))

    const onResize = () => {
      if (dragRef.current) return
      const bounds = viewportBounds()
      const saved = savedRef.current
      const next = posicionarAjuda(saved, bounds)
      updatePosition(next)
      if (saved) {
        const adjusted = { side: saved.side, y: next.y }
        savedRef.current = adjusted
        save(adjusted)
      }
    }

    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  function pointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || !positionRef.current) return
    ignoreClickRef.current = false
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      original: positionRef.current, dragged: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.dragged && Math.hypot(dx, dy) < 6) return
    drag.dragged = true
    ignoreClickRef.current = true
    event.preventDefault()
    updatePosition(limitarAjuda({ x: drag.original.x + dx, y: drag.original.y + dy }, viewportBounds()))
  }

  function pointerUp(event: React.PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.dragged || !positionRef.current) return
    event.preventDefault()
    const snapped = encaixarAjuda(positionRef.current, viewportBounds())
    updatePosition(snapped.position)
    setSide(snapped.saved.side)
    setCustomized(true)
    savedRef.current = snapped.saved
    save(snapped.saved)
  }

  function pointerCancel() {
    const drag = dragRef.current
    dragRef.current = null
    if (drag) updatePosition(limitarAjuda(drag.original, viewportBounds()))
  }

  function reset() {
    const next = posicionarAjuda(null, viewportBounds())
    updatePosition(next)
    setSide('right')
    setCustomized(false)
    savedRef.current = null
    save(null)
  }

  if (!position) return null

  return (
    <div className="fixed z-40 md:hidden" style={{ left: position.x, top: position.y, width: HELP_SIZE, height: HELP_SIZE }}>
      <a
        href={publicStore?matilhaWhatsAppUrl('Olá! Vim pela vitrine da Matilha Prado.'):DEFAULT_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com a Matilha Prado no WhatsApp (arraste para reposicionar)"
        title="Arraste para mover ou toque para falar no WhatsApp"
        className="flex size-12 touch-none select-none items-center justify-center rounded-full bg-green-500 text-white shadow-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-green-500"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onClick={(event) => {
          if (ignoreClickRef.current) {
            event.preventDefault()
            ignoreClickRef.current = false
          }
        }}
        draggable={false}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
      </a>
      {customized && (
        <button
          type="button"
          onClick={reset}
          aria-label="Restaurar posição do WhatsApp"
          title="Restaurar posição"
          className={`absolute -top-2 ${side === 'left' ? '-right-2' : '-left-2'} flex size-6 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md focus-visible:outline-2 focus-visible:outline-ring`}
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  )
}
