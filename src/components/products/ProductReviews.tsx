'use client'
import { useEffect, useState } from 'react'
import { Star, BadgeCheck } from 'lucide-react'
type Reviews = {
  average: number | null
  count: number
  reviews: { id: string; rating: number; author: string; comment: string }[]
}
export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<Reviews | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/public/avaliacoes?produtoId=' + encodeURIComponent(productId), {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
    return () => controller.abort()
  }, [productId])
  if (!data) return null
  return (
    <section
      className="mt-6 space-y-3 border-t pt-5"
      aria-label="Avaliações verificadas"
    >
      <h3 className="font-bold">Avaliações de clientes</h3>
      {data.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este produto ainda não tem avaliações. Após comprar, você pode avaliar
          em “Minhas Compras”.
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm">
            <Star className="size-4 fill-amber-400 text-amber-500" />
            {data.average?.toFixed(1)} de 5 · {data.count} avaliações
          </p>
          {data.reviews.map((r) => (
            <article key={r.id} className="rounded-xl bg-muted/50 p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {r.author} · {r.rating}/5{' '}
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <BadgeCheck className="size-3" />
                  Compra verificada
                </span>
              </p>
              <p className="mt-2 break-words text-sm">{r.comment}</p>
            </article>
          ))}
        </>
      )}
    </section>
  )
}
