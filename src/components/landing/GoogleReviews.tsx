'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MATILHA_CONTACT } from '@/lib/matilha-contact'

type Review = {
  authorName: string
  authorUrl: string | null
  profilePhotoUrl: string | null
  rating: number
  relativeTime: string | null
  text: string
  publishedAt: string | null
}

type ReviewsPayload = {
  success: boolean
  configured?: boolean
  source?: string
  orderedBy?: string
  place?: {
    name?: string | null
    rating?: number | null
    reviewCount?: number | null
    url?: string | null
  }
  reviews?: Review[]
}

export function GoogleReviews() {
  const [payload, setPayload] = useState<ReviewsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const response = await fetch('/api/public/google-reviews', {
          cache: 'no-store',
        })
        const data = (await response.json().catch(() => null)) as ReviewsPayload | null
        if (active) setPayload(data)
      } catch {
        if (active) setPayload(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Carregando avaliações do Google Maps...
      </div>
    )
  }

  const reviews = payload?.success ? payload.reviews || [] : []
  const googleUrl = payload?.place?.url || MATILHA_CONTACT.google

  if (reviews.length === 0) {
    return (
      <Card className="mx-auto max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Confira as avaliações mais recentes da Matilha Prado diretamente no Google Maps.
          </p>
          <Button asChild variant="outline">
            <a href={googleUrl} target="_blank" rel="noreferrer">
              Ver avaliações no Google Maps
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        {typeof payload?.place?.rating === 'number' && (
          <Badge variant="secondary" className="gap-1">
            <Star className="size-3.5 fill-orange-400 text-orange-400" />
            {payload.place.rating.toFixed(1)}
          </Badge>
        )}
        {typeof payload?.place?.reviewCount === 'number' && (
          <span>{payload.place.reviewCount} avaliações no Google Maps</span>
        )}
        <span className="text-xs">Mais recentes primeiro</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 3).map((review, index) => (
          <Card key={`${review.authorName}-${review.publishedAt || index}`} className="card-hover h-full py-0">
            <CardContent className="flex h-full flex-col p-6">
              <div className="mb-3 flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={
                      star <= Math.round(review.rating)
                        ? 'size-4 fill-orange-400 text-orange-400'
                        : 'size-4 text-muted-foreground/25'
                    }
                  />
                ))}
              </div>

              <p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{review.text}&rdquo;
              </p>

              <div className="border-t pt-4">
                <div className="flex items-center gap-3">
                  {review.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.profilePhotoUrl}
                      alt=""
                      className="size-10 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700">
                      {review.authorName.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {review.authorUrl ? (
                      <a
                        href={review.authorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {review.authorName}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-semibold">{review.authorName}</p>
                    )}
                    {review.relativeTime && (
                      <p className="text-xs text-muted-foreground">{review.relativeTime}</p>
                    )}
                  </div>
                </div>

                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Fonte: Google Maps
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Button asChild variant="outline" size="sm">
          <a href={googleUrl} target="_blank" rel="noreferrer">
            Ver todas no Google Maps
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
