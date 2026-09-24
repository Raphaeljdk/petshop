import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEFAULT_PLACE_ID = 'ChIJM21vIv33zpQRZ4M0vWnu090'

type LocalizedText = { text?: string }

type GoogleReview = {
  relativePublishTimeDescription?: string
  rating?: number
  text?: LocalizedText
  originalText?: LocalizedText
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
  publishTime?: string
  googleMapsUri?: string
}

type GooglePlaceDetailsResponse = {
  id?: string
  displayName?: LocalizedText
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  reviews?: GoogleReview[]
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
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`,
      {
        next: { revalidate: 3600 },
        headers: {
          Accept: 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,googleMapsUri,reviews',
        },
      }
    )

    const payload = (await response.json()) as GooglePlaceDetailsResponse

    if (!response.ok || !payload) {
      console.error('[google-reviews] Places API (New) error:', {
        httpStatus: response.status,
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

    const reviews = (payload.reviews || [])
      .map((review) => ({
        authorName: review.authorAttribution?.displayName || 'Cliente',
        authorUrl: review.authorAttribution?.uri || null,
        profilePhotoUrl: review.authorAttribution?.photoUri || null,
        rating: Math.min(5, Math.max(0, Number(review.rating || 0))),
        relativeTime: review.relativePublishTimeDescription || null,
        text: review.text?.text?.trim() || review.originalText?.text?.trim() || '',
        publishedAt: review.publishTime || null,
      }))
      .filter((review) => review.text)
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      configured: true,
      source: 'Google Maps',
      orderedBy: 'newest',
      place: {
        name: payload.displayName?.text || 'Matilha Prado',
        rating: payload.rating ?? null,
        reviewCount: payload.userRatingCount ?? null,
        url: payload.googleMapsUri || null,
      },
      reviews,
    })
  } catch (error) {
    console.error('[google-reviews] Places API (New) request failed:', error)
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
