import { NextRequest } from 'next/server'
import { authJson } from '@/lib/auth-http'
import { GOOGLE_PENDING_COOKIE, readGooglePending } from '@/lib/google-oauth'

export async function GET(req: NextRequest) {
  const pending = readGooglePending(req.cookies.get(GOOGLE_PENDING_COOKIE)?.value)
  if (!pending) return authJson({ success: false, error: 'O cadastro com Google expirou. Tente novamente.' }, 410)
  return authJson({ success: true, email: pending.email, nome: pending.nome })
}
