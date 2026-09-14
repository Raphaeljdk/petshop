import { NextResponse } from 'next/server'
import { removerCookieAuth } from '@/lib/auth-cookies'

export async function POST() {
  try {
    await removerCookieAuth()
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('logout erro:', e)
    return NextResponse.json(
      { success: false, error: 'Erro no logout' },
      { status: 500 }
    )
  }
}
