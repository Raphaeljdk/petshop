'use client'

import type { RefObject } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FloatingCartButtonProps = {
  buttonRef?: RefObject<HTMLButtonElement | null>
  itemCount: number
  total: number
  onClick: () => void
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function FloatingCartButton({
  buttonRef,
  itemCount,
  total,
  onClick,
}: FloatingCartButtonProps) {
  if (itemCount <= 0) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:left-auto sm:right-6 sm:w-auto sm:max-w-none sm:translate-x-0">
      <Button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="floating-cart-button h-auto min-h-14 w-full justify-between rounded-2xl px-4 py-3 sm:min-w-[270px]"
        aria-label={`Abrir carrinho com ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      >
        <span className="flex items-center gap-3">
          <span className="relative flex size-10 items-center justify-center rounded-xl bg-white/15">
            <ShoppingCart className="size-5" />
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-primary"
            >
              {itemCount}
            </span>
          </span>
          <span className="text-left">
            <span className="block text-xs font-medium text-white/75">Ver carrinho</span>
            <span className="block text-sm font-bold">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          </span>
        </span>
        <strong className="ml-4 whitespace-nowrap text-sm tabular-nums">
          {money(total)}
        </strong>
      </Button>
    </div>
  )
}
