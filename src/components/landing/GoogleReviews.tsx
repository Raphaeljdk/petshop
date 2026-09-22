'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MATILHA_CONTACT } from '@/lib/matilha-contact'

type Review = {
  id: string
  author: string
  authorUrl: string | null
  authorPhoto: string | null
  rating: number
  text: string
  relativeTime: string | null
  publishedAt: string | null
  googleMapsUri: string | null
  flagContentUri: string | null
}

type ReviewsResponse = {
  configured?: boolean
  available?: boolean
  placeName?: string
  rating?: number | null
  userRatingCount?: number
  googleMapsUri?: string | null
  writeAReviewUri?: string | null
  reviews?: Review[]
}

export function GoogleReviews() {
  const [data, setData] = useState<ReviewsResponse | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/public/google-reviews', { cache: 'no-store' })
      .then(async (res) => {
        const payload = await res.json().catch(() => null)
        if (active) setData(payload)
      })
      .catch(() => {
        if (active) setData(null)
      })
    return () => {
      active = false
    }
  }, [])

  const reviews = data?.reviews || []
  const googleUrl = data?.googleMapsUri || MATILHA_CONTACT.google

  return (
    <section id="depoimentos" className="py-12 sm:py-16 lg:py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <Badge variant="secondary" className="mb-3">Avaliações do Google</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">O que nossos clientes dizem</h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Depoimentos publicados por clientes reais no perfil da Matilha Prado no Google.
          </p>

          {data?.rating ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
              <strong className="text-lg">{data.rating.toFixed(1)}</strong>
              <div className="flex gap-0.5" aria-label={`Nota ${data.rating} de 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-4 ${star <= Math.round(data.rating || 0) ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground/30'}`}
                  />
                ))}
              </div>
              <span className="text-muted-foreground">
                {data.userRatingCount || 0} avaliação(ões) no Google
              </span>
            </div>
          ) : null}
        </div>

        {reviews.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {reviews.slice(0, 3).map((review) => (
                <Card key={review.id} className="card-hover py-0">
                  <CardContent className="p-6">
                    <div className="flex gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`size-4 ${star <= review.rating ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground/25'}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 italic line-clamp-6">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold overflow-hidden shrink-0">
                        {review.authorPhoto ? (
                          <Image
                            src={review.authorPhoto}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 object-cover"
                          />
                        ) : (
                          review.author[0]?.toUpperCase() || 'G'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{review.author}</p>
                        <p className="text-xs text-muted-foreground">
                          Google {review.relativeTime ? `· ${review.relativeTime}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {review.googleMapsUri && (
                        <Button asChild variant="outline" size="sm">
                          <a href={review.googleMapsUri} target="_blank" rel="noreferrer">
                            Ver no Google <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                      )}
                      {review.flagContentUri && (
                        <a
                          href={review.flagContentUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-muted-foreground underline underline-offset-2"
                        >
                          Denunciar conteúdo
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <a href={googleUrl} target="_blank" rel="noreferrer">
                  Ver todas no Google <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                As avaliações reais do Google serão exibidas aqui assim que a integração da API for ativada.
              </p>
              <Button asChild className="mt-4">
                <a href={googleUrl} target="_blank" rel="noreferrer">
                  Ver avaliações no Google <ExternalLink className="size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
