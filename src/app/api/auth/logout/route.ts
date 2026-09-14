import { NextRequest } from 'next/server'
import { removerCookieAuth } from '@/lib/auth-cookies'
import { assertSameOrigin, authFailure, authJson } from '@/lib/auth-http'

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await removerCookieAuth()
    return authJson({ success: true })
  } catch (error) { return authFailure(error) }
}
