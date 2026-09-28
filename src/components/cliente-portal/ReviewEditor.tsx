'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { portalRequest, useExperience } from './ExperienceProvider'
import { toast } from 'sonner'

export function ReviewEditor({
  productId,
  name,
}: {
  productId: string
  name: string
}) {
  const { ready } = useExperience()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  if (!ready) return null
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          setOpen(true)
          try {
            const rows = await portalRequest<
              { produtoId: string; rating: number; comment: string }[]
            >('/api/cliente/avaliacoes')
            const current = rows.find((r) => r.produtoId === productId)
            if (current) {
              setRating(current.rating)
              setComment(current.comment)
            }
          } catch {
            /* Server still verifies purchase at submission. */
          }
        }}
      >
        <Star className="size-4" />
        Avaliar {name}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar {name}</DialogTitle>
            <DialogDescription>
              Compra verificada. Sua nota, comentário e primeiro nome ficarão
              visíveis na página do produto. Evite informações pessoais no
              comentário.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor={`rating-${productId}`}
            className="text-sm font-medium"
          >
            Nota
          </label>
          <select
            id={`rating-${productId}`}
            className="h-11 rounded-md border bg-background px-3"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'estrela' : 'estrelas'}
              </option>
            ))}
          </select>
          <label
            htmlFor={`review-${productId}`}
            className="text-sm font-medium"
          >
            Sua experiência
          </label>
          <Textarea
            id={`review-${productId}`}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Como foi a experiência com este produto?"
          />
          <Button
            disabled={busy || comment.trim().length < 3}
            onClick={async () => {
              setBusy(true)
              try {
                await portalRequest('/api/cliente/avaliacoes', {
                  method: 'POST',
                  body: JSON.stringify({
                    produtoId: productId,
                    rating,
                    comment,
                  }),
                })
                toast.success('Avaliação salva')
                setOpen(false)
              } catch (error) {
                toast.error((error as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            Publicar avaliação
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
