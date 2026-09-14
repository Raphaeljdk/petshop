'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  trigger: number
}

interface Piece {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  rotate: number
  size: number
  shape: 'circle' | 'square' | 'rect'
}

const COLORS = ['#FF8E3C', '#EC4899', '#22D3EE', '#FF8E3C', '#F472B6', '#06B6D4']

function genPieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.6 + Math.random() * 1.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 8,
    shape: (['circle', 'square', 'rect'] as const)[Math.floor(Math.random() * 3)],
  }))
}

export function Confetti({ trigger }: ConfettiProps) {
  const [active, setActive] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (trigger <= 0 || media.matches) return
    const start = setTimeout(() => { setPieces(genPieces(40)); setActive(true) }, 0)
    const hide = setTimeout(() => setActive(false), 3200)
    const stopForReducedMotion = () => { if (media.matches) setActive(false) }
    media.addEventListener('change', stopForReducedMotion)
    return () => { clearTimeout(start); clearTimeout(hide); media.removeEventListener('change', stopForReducedMotion) }
  }, [trigger])

  if (!active || pieces.length === 0) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 1.6 : p.size,
            background: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'square' ? '2px' : '1px',
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s linear forwards`,
          }}
        />
      ))}
    </div>
  )
}
