import { NextResponse } from 'next/server'

export const revalidate = 21600

type GoogleReview = {
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
  rating?: number
  text?: {
    text?: string
    languageCode?: string
  }
  originalText?: {
    text?: string
    languageCode?: string
  }
  relativePublishTimeDescription?: string
  publishTime?: string
  googleMapsUri?: string
  flagContentUri?: string
}

type GooglePlace = {
  displayName?: {
    text?: string
  }
  rating?: number
  userRatingCount?: number
  googleMapsLinks?: {
    placeUri?: string
    reviewsUri?: string
    writeAReviewUri?: string
  }
  reviews?: GoogleReview[]
}

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  const placeId = process.env.GOOGLE_PLACE_ID?.trim()

  if (!apiKey || !placeId) {
    return NextResponse.json(
      {
        configured: false,
        reviews: [],
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    )
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'displayName,rating,userRatingCount,reviews,googleMapsLinks',
        },
        next: { revalidate: 21600 },
      }
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[google-reviews] Places API:', response.status, detail)
      return NextResponse.json(
        {
          configured: true,
          available: false,
          reviews: [],
        },
        { status: 502 }
      )
    }

    const place = (await response.json()) as GooglePlace
    const reviews = (place.reviews || [])
      .filter((review) => Boolean(review.text?.text || review.originalText?.text))
      .map((review, index) => ({
        id: `${review.publishTime || 'review'}-${index}`,
        author: review.authorAttribution?.displayName || 'Cliente Google',
        authorUrl: review.authorAttribution?.uri || null,
        authorPhoto: review.authorAttribution?.photoUri || null,
        rating: Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))),
        text: review.text?.text || review.originalText?.text || '',
        relativeTime: review.relativePublishTimeDescription || null,
        publishedAt: review.publishTime || null,
        googleMapsUri: review.googleMapsUri || null,
        flagContentUri: review.flagContentUri || null,
      }))

    return NextResponse.json(
      {
        configured: true,
        available: true,
        placeName: place.displayName?.text || 'Matilha Prado',
        rating: Number(place.rating) || null,
        userRatingCount: Number(place.userRatingCount) || 0,
        googleMapsUri:
          place.googleMapsLinks?.reviewsUri ||
          place.googleMapsLinks?.placeUri ||
          null,
        writeAReviewUri: place.googleMapsLinks?.writeAReviewUri || null,
        reviews,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('[google-reviews] erro:', error)
    return NextResponse.json(
      {
        configured: true,
        available: false,
        reviews: [],
      },
      { status: 500 }
    )
  }
}
