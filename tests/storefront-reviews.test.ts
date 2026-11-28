import { expect, spyOn, test } from 'bun:test'
import { GET } from '../src/app/api/public/google-reviews/route'

test('a prévia consulta as avaliações públicas sem credenciais e oferece o Maps durante falhas', async () => {
  const environment = process.env.VERCEL_ENV
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const fetchReviews = spyOn(globalThis, 'fetch')
  try {
    process.env.VERCEL_ENV = 'preview'
    delete process.env.GOOGLE_PLACES_API_KEY
    const payload = { success: true, source: 'Google Maps', reviews: [] }
    fetchReviews.mockResolvedValueOnce(Response.json(payload))
    const response = await GET()
    expect(await response.json()).toEqual(payload)
    expect(fetchReviews).toHaveBeenCalledWith(
      'https://www.matilhaprado.com.br/api/public/google-reviews',
      expect.objectContaining({ credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } }),
    )
    fetchReviews.mockResolvedValueOnce(new Response(null, { status: 503 }))
    expect((await GET()).status).toBe(503)
    process.env.VERCEL_ENV = 'production'
    expect((await GET()).status).toBe(503)
    expect(fetchReviews).toHaveBeenCalledTimes(2)
  } finally {
    fetchReviews.mockRestore()
    if (environment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = environment
    if (apiKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = apiKey
  }
})
