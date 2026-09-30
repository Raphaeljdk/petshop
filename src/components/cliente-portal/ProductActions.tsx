'use client'

import { useState } from 'react'
import { Bell, CalendarClock, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useExperience } from './ExperienceProvider'
import { toast } from 'sonner'

export function ProductActions({
  product,
}: {
  product: { id: string; nome: string; estoque: number; estoqueIlimitado?: boolean }
}) {
  const { preferences, ready, busy, update } = useExperience()
  const preference = preferences.find((row) => row.produtoId === product.id)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  if (!ready) return null
  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-t pt-2">
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11"
          aria-label={`Favoritar ${product.nome}`}
          aria-pressed={!!preference?.favorite}
          disabled={busy}
          onClick={async () => {
            if (
              await update({
                produtoId: product.id,
                favorite: !preference?.favorite,
              })
            )
              toast.success(
                preference?.favorite
                  ? 'Removido dos favoritos'
                  : 'Salvo nos favoritos',
              )
          }}
        >
          <Heart
            className={
              preference?.favorite
                ? 'size-4 fill-rose-500 text-rose-500'
                : 'size-4'
            }
          />
          <span>Favorito</span>
        </Button>
        {!product.estoqueIlimitado && product.estoque <= 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            aria-pressed={!!preference?.restock}
            disabled={busy}
            onClick={async () => {
              if (
                await update({
                  produtoId: product.id,
                  restock: !preference?.restock,
                })
              )
                toast.success(
                  preference?.restock
                    ? 'Aviso cancelado'
                    : 'Você verá o aviso no portal quando voltar ao estoque',
                )
            }}
          >
            <Bell className="size-4" />
            {preference?.restock ? 'Aviso ativado' : 'Avise quando chegar'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            onClick={() => setOpen(true)}
          >
            <CalendarClock className="size-4" />
            Lembrar
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lembrete de reposição</DialogTitle>
            <DialogDescription>
              {product.nome}: o lembrete aparecerá na área “Meus favoritos e
              lembretes” do portal. Você também poderá adicioná-lo ao calendário
              do celular.
            </DialogDescription>
          </DialogHeader>
          <label
            className="text-sm font-medium"
            htmlFor={`reminder-${product.id}`}
          >
            Quando lembrar?
          </label>
          <Input
            id={`reminder-${product.id}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button
            disabled={!date || busy}
            onClick={async () => {
              if (
                await update({
                  produtoId: product.id,
                  reminderAt: new Date(date + 'T12:00:00-03:00').toISOString(),
                })
              ) {
                toast.success('Lembrete salvo')
                setOpen(false)
              }
            }}
          >
            Salvar lembrete
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
