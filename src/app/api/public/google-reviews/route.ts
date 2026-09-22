import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEFAULT_PLACE_ID = 'ChIJM21vIv33zpQRZ4M0vWnu090'

type GoogleReview = {
  author_name?: string
  author_url?: string
  profile_photo_url?: string
  rating?: number
  relative_time_description?: string
  text?: string
  time?: number
}

type GooglePlaceDetailsResponse = {
  status?: string
  error_message?: string
  result?: {
    name?: string
    rating?: number
    user_ratings_total?: number
    url?: string
    reviews?: GoogleReview[]
  }
}

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  const placeId = process.env.GOOGLE_PLACE_ID?.trim() || DEFAULT_PLACE_ID

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: 'Google Places API não configurada.',
      },
      { status: 503 }
    )
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      language: 'pt-BR',
      reviews_sort: 'newest',
      fields: 'name,rating,user_ratings_total,url,reviews',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      }
    )

    const payload = (await response.json()) as GooglePlaceDetailsResponse

    if (!response.ok || payload.status !== 'OK' || !payload.result) {
      console.error('[google-reviews] Places API error:', {
        httpStatus: response.status,
        apiStatus: payload.status,
        message: payload.error_message,
      })

      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: 'Não foi possível carregar as avaliações do Google Maps.',
        },
        { status: 502 }
      )
    }

    const reviews = (payload.result.reviews || [])
      .filter((review) => review.text?.trim())
      .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
      .slice(0, 5)
      .map((review) => ({
        authorName: review.author_name || 'Cliente',
        authorUrl: review.author_url || null,
        profilePhotoUrl: review.profile_photo_url || null,
        rating: Math.min(5, Math.max(0, Number(review.rating || 0))),
        relativeTime: review.relative_time_description || null,
        text: review.text?.trim() || '',
        publishedAt: review.time
          ? new Date(review.time * 1000).toISOString()
          : null,
      }))

    return NextResponse.json({
      success: true,
      configured: true,
      source: 'Google Maps',
      orderedBy: 'newest',
      place: {
        name: payload.result.name || 'Matilha Prado',
        rating: payload.result.rating ?? null,
        reviewCount: payload.result.user_ratings_total ?? null,
        url: payload.result.url || null,
      },
      reviews,
    })
  } catch (error) {
    console.error('[google-reviews] request failed:', error)
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: 'Não foi possível carregar as avaliações do Google Maps.',
      },
      { status: 502 }
    )
  }
}
