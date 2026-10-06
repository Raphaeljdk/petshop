import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  MELHOR_ENVIO_COOKIE,
  melhorEnvioOAuthConfig,
  melhorEnvioUsaSandbox,
} from '@/lib/melhor-envio'

export const runtime = 'nodejs'

const KNOWN_ERRORS = new Set([
  'access_denied',
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
  'unauthorized_client',
  'unsupported_grant_type',
])

function safeError(value: unknown, fallback = 'oauth_failed') {
  const normalized = String(value || '').trim().toLowerCase()
  return KNOWN_ERRORS.has(normalized) ? normalized : fallback
}

function equal(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function tokenPage(payload: {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  sandbox: boolean
}) {
  const expiresAt = payload.expiresIn
    ? new Date(Date.now() + Number(payload.expiresIn) * 1000).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
    : 'não informado'

  const envLines = [
    `MELHOR_ENVIO_ACCESS_TOKEN="${payload.accessToken}"`,
    payload.refreshToken
      ? `MELHOR_ENVIO_REFRESH_TOKEN="${payload.refreshToken}"`
      : '',
    `MELHOR_ENVIO_SANDBOX="${payload.sandbox ? 'true' : 'false'}"`,
  ].filter(Boolean)

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Melhor Envio conectado</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f8; color: #17202a; }
      main { max-width: 840px; margin: 48px auto; padding: 32px; background: white; border: 1px solid #d9dee3; border-radius: 12px; }
      h1 { margin-top: 0; font-size: 28px; }
      p { line-height: 1.55; }
      textarea { width: 100%; min-height: 180px; box-sizing: border-box; padding: 16px; border: 1px solid #c6ccd2; border-radius: 8px; font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .warn { padding: 12px 14px; background: #fff7e6; border: 1px solid #ffd591; border-radius: 8px; }
      .meta { color: #5d6d7e; }
    </style>
  </head>
  <body>
    <main>
      <h1>Melhor Envio conectado</h1>
      <p>A autorização funcionou. Copie estas variáveis para o ambiente seguro do servidor/Vercel.</p>
      <p class="warn">Não envie esses valores por chat, print ou repositório. Eles dão acesso à integração.</p>
      <textarea readonly>${escapeHtml(envLines.join('\n'))}</textarea>
      <p class="meta">Expira em: ${escapeHtml(expiresAt)}</p>
      <p>Depois de salvar as variáveis e redeployar, a cotação do Melhor Envio entra no checkout.</p>
    </main>
  </body>
</html>`
}

export async function GET(req: NextRequest) {
  const pending = req.cookies.get(MELHOR_ENVIO_COOKIE)?.value
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const providerError = req.nextUrl.searchParams.get('error')
  const user = await getUsuarioLogado()

  const invalid = () =>
    NextResponse.json(
      { error: 'Autorização inválida ou ausente. Inicie pela rota de conectar do Melhor Envio.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )

  if (providerError && user?.role === 'ADMIN') {
    const url = new URL('/?melhor_envio=error', req.url)
    url.searchParams.set('code', safeError(providerError))
    return NextResponse.redirect(url)
  }

  if (!pending || !code || !state || !user || user.role !== 'ADMIN') return invalid()

  let flow: { state: string; userId: string }
  try {
    flow = JSON.parse(pending)
  } catch {
    return invalid()
  }
  if (!flow.state || !equal(state, flow.state) || flow.userId !== user.id) return invalid()

  const clearCookie = (response: NextResponse) => {
    response.cookies.set(MELHOR_ENVIO_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/integracoes/melhor-envio',
      maxAge: 0,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  try {
    const config = melhorEnvioOAuthConfig()
    const tokenResponse = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': config.userAgent,
      },
      cache: 'no-store',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const payload = (await tokenResponse.json().catch(() => null)) as { error?: string } | null
      throw new Error(safeError(payload?.error, `http_${tokenResponse.status}`))
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!tokens.access_token) throw new Error('Resposta OAuth incompleta')

    return clearCookie(
      new NextResponse(
        tokenPage({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          sandbox: melhorEnvioUsaSandbox(),
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    )
  } catch (error) {
    const code = safeError(error instanceof Error ? error.message : null)
    console.error('Melhor Envio OAuth:', code)
    const url = new URL('/?melhor_envio=error', req.url)
    url.searchParams.set('code', code)
    return clearCookie(NextResponse.redirect(url))
  }
}
