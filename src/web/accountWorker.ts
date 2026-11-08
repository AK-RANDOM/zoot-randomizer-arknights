import { createHash } from 'node:crypto'
import { parseArknightsSyncData } from '../main/arknightsAccount/parser'
import { ArknightsAccountProtocol } from '../main/arknightsAccount/protocol'
import { requireArknightsAccountServer } from '../shared/desktopIpc'

interface AccountWorkerBindings {
  ACCOUNT_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
  ACCOUNT_WEB_ORIGIN?: string
}

const upstreamHosts = new Set([
  'en-sdk-api.yostarplat.com',
  'jp-sdk-api.yostarplat.com',
  'ak-conf.arknights.global',
  'ak-conf.arknights.jp',
  'ak-conf.arknights.kr',
  'as.arknights.global',
  'as.arknights.jp',
  'as.arknights.kr',
  'gs.arknights.global',
  'gs.arknights.jp',
  'gs.arknights.kr',
  'ark-us-static-online.yo-star.com',
  'ark-jp-static-online.yo-star.com',
  'ark-kr-static-online-1300509597.yo-star.com',
])

const protocol = new ArknightsAccountProtocol({
  async fetch(input, init) {
    const url = new URL(String(input))
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !upstreamHosts.has(url.hostname) ||
      (url.port && url.port !== '8443')
    )
      throw new Error('Unsupported account service endpoint.')
    // Workers supports manual redirects. Reject them before sending credentials to a new URL.
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    })
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Unexpected account service redirect.')
    }
    return response
  },
})

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing request body.')
  const buffer = new Uint8Array(2048)
  let offset = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (offset + value.byteLength > buffer.byteLength) {
      await reader.cancel()
      throw new Error('Request body is too large.')
    }
    buffer.set(value, offset)
    offset += value.byteLength
  }
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, offset))) as Record<string, unknown>
}

async function handleAccountRequest(
  request: Request,
  env: AccountWorkerBindings,
): Promise<Response> {
  const url = new URL(request.url)
  const sendCode = url.pathname === '/api/arknights/send-code'
  if (!sendCode && url.pathname !== '/api/arknights/sync') return json({ error: 'Not found.' }, 404)
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return json({ error: 'Expected JSON.' }, 415)
  }

  const address = request.headers.get('CF-Connecting-IP') ?? 'local'
  const ipLimit = await env.ACCOUNT_LIMIT.limit({ key: `ip:${address}` })
  if (!ipLimit.success) return json({ error: 'Too many attempts. Try again in a minute.' }, 429)

  let server, email, code
  try {
    const input = await readInput(request)
    server = requireArknightsAccountServer(input.server)
    email = typeof input.email === 'string' ? input.email.trim() : ''
    code = typeof input.code === 'string' ? input.code.trim() : ''
    if (
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (!sendCode && !/^\d{6}$/.test(code))
    ) {
      throw new Error('Invalid account input.')
    }
  } catch {
    return json({ error: 'Check the server, email, and six-digit verification code.' }, 400)
  }

  const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex')
  const emailLimit = await env.ACCOUNT_LIMIT.limit({ key: `email:${emailHash}` })
  if (!emailLimit.success) return json({ error: 'Too many attempts. Try again in a minute.' }, 429)
  try {
    if (sendCode) {
      await protocol.requestLoginCode(server, email)
      return json({})
    }
    const payload = await protocol.fetchSyncDataWithEmailCode(server, email, code)
    return json(parseArknightsSyncData(payload, server))
  } catch {
    return json(
      {
        error: sendCode
          ? 'YoStar could not send a code. Check your server and email, then try again.'
          : 'Account sync failed. Check your verification code and try again.',
      },
      502,
    )
  }
}

export default {
  async fetch(request: Request, env: AccountWorkerBindings): Promise<Response> {
    const origin = request.headers.get('Origin')
    const crossOrigin = origin && origin === env.ACCOUNT_WEB_ORIGIN
    if (!crossOrigin && origin !== new URL(request.url).origin) {
      return json({ error: 'Invalid origin.' }, 403)
    }
    if (!crossOrigin) return handleAccountRequest(request, env)

    const response =
      request.method === 'OPTIONS'
        ? new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Cache-Control': 'no-store',
            },
          })
        : await handleAccountRequest(request, env)
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.append('Vary', 'Origin')
    return response
  },
}
