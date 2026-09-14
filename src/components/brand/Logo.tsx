'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl'
export type LogoVariant = 'default' | 'light'

interface LogoProps {
  size?: LogoSize
  withText?: boolean
  animated?: boolean
  variant?: LogoVariant
  className?: string
}

const SIZES: Record<
  LogoSize,
  { box: number; img: number; text: string }
> = {
  sm: { box: 36, img: 30, text: 'text-base' },
  md: { box: 44, img: 36, text: 'text-lg' },
  lg: { box: 56, img: 46, text: 'text-xl' },
  xl: { box: 80, img: 66, text: 'text-3xl' },
}

export function Logo({
  size = 'md',
  withText = true,
  animated = false,
  variant = 'default',
  className,
}: LogoProps) {
  const s = SIZES[size]
  const isLight = variant === 'light'

  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        animated && 'animate-scale-in',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center shrink-0 overflow-hidden',
          isLight ? 'bg-white/95' : 'logo-container'
        )}
        style={{
          width: s.box,
          height: s.box,
          borderRadius: 12,
        }}
      >
        <Image
          src="/images/logo-matilha-prado-1024.png"
          alt="Matilha Prado"
          width={s.img}
          height={s.img}
          priority
          style={{ objectFit: 'contain', transform: 'scale(1.6)' }}
        />
      </div>
      {withText && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-bold tracking-tight',
              s.text,
              isLight ? 'text-white' : 'text-foreground'
            )}
          >
            Matilha <span className="text-primary">Prado</span>
          </span>
          {(size === 'lg' || size === 'xl') && (
            <span
              className={cn(
                'uppercase tracking-widest text-xs font-semibold mt-0.5',
                isLight ? 'text-white/60' : 'text-muted-foreground'
              )}
            >
              Pet Shop
            </span>
          )}
        </div>
      )}
    </div>
  )
}
