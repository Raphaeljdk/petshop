'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Star } from 'lucide-react'
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
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    skipSnaps: false,
  })

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

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    setScrollSnaps(emblaApi.scrollSnapList())
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)

    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi) return
    const timer = window.setInterval(() => {
      if (!document.hidden) emblaApi.scrollNext()
    }, 5500)

    return () => window.clearInterval(timer)
  }, [emblaApi])

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
          <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1">
            <Star className="size-3.5 fill-orange-400 text-orange-400" />
            {payload.place.rating.toFixed(1)}
          </Badge>
        )}
        {typeof payload?.place?.reviewCount === 'number' && (
          <span>{payload.place.reviewCount} avaliações no Google</span>
        )}
      </div>

      <div className="reviews-carousel relative">
        <div ref={emblaRef} className="overflow-hidden px-1 py-2">
          <div className="-ml-3 flex touch-pan-y">
            {reviews.slice(0, 8).map((review, index) => (
              <div
                key={`${review.authorName}-${review.publishedAt || index}`}
                className="min-w-0 flex-[0_0_88%] pl-3 sm:flex-[0_0_48%] lg:flex-[0_0_33.333%]"
              >
                <Card className="review-slide-card h-full border-border/70 py-0">
                  <CardContent className="flex min-h-[250px] h-full flex-col p-5 sm:p-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
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
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {review.relativeTime || 'Google'}
                      </span>
                    </div>

                    <p className="line-clamp-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{review.text}&rdquo;
                    </p>

                    <div className="mt-5 flex items-center gap-3 border-t pt-4">
                      {review.profilePhotoUrl ? (
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
                        <p className="text-xs text-muted-foreground">Avaliação verificada no Google</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {reviews.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              className="review-carousel-arrow review-carousel-arrow-left"
              aria-label="Avaliação anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              className="review-carousel-arrow review-carousel-arrow-right"
              aria-label="Próxima avaliação"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-1.5" aria-label="Navegação das avaliações">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ir para avaliação ${index + 1}`}
              aria-current={selectedIndex === index ? 'true' : undefined}
              onClick={() => emblaApi?.scrollTo(index)}
              className={selectedIndex === index ? 'review-dot review-dot-active' : 'review-dot'}
            />
          ))}
        </div>

        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href={googleUrl} target="_blank" rel="noreferrer">
            Ver todas no Google Maps
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
