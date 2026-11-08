import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArknightsAccountProtocol } from '../main/arknightsAccount/protocol'
import worker from './accountWorker'

const origin = 'https://randomizer.example'

function syncRequest(requestOrigin = origin) {
  return new Request(`${origin}/api/arknights/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify({ server: 'en', email: 'doctor@example.com', code: '123456' }),
  })
}

afterEach(() => vi.restoreAllMocks())

describe('web account sync', () => {
  it('allows the configured Pages origin to preflight and read API responses', async () => {
    const pagesOrigin = 'https://ak-random.github.io'
    const env = {
      ACCOUNT_WEB_ORIGIN: pagesOrigin,
      ACCOUNT_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) },
    }
    const response = await worker.fetch(
      new Request(`${origin}/api/arknights/sync`, {
        method: 'OPTIONS',
        headers: { Origin: pagesOrigin, 'Access-Control-Request-Method': 'POST' },
      }),
      env,
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(pagesOrigin)
    const limited = await worker.fetch(syncRequest(pagesOrigin), env)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(pagesOrigin)
  })

  it('returns only the parsed account snapshot and forbids caching', async () => {
    vi.spyOn(ArknightsAccountProtocol.prototype, 'fetchSyncDataWithEmailCode').mockResolvedValue({
      secret: 'upstream secret',
      user: { troop: { chars: {} }, email: 'doctor@example.com' },
    })
    const limit = vi.fn().mockResolvedValue({ success: true })
    const response = await worker.fetch(syncRequest(), { ACCOUNT_LIMIT: { limit } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const result = await response.text()
    expect(JSON.parse(result).snapshot).toMatchObject({ server: 'en', operators: [] })
    expect(result).not.toMatch(/upstream secret|doctor@example\.com|123456/)
    expect(limit).toHaveBeenCalledTimes(2)
  })

  it('blocks cross-origin and rate-limited requests before contacting upstream', async () => {
    const upstream = vi.spyOn(ArknightsAccountProtocol.prototype, 'fetchSyncDataWithEmailCode')
    const env = { ACCOUNT_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) } }
    expect((await worker.fetch(syncRequest('https://other.example'), env)).status).toBe(403)
    expect((await worker.fetch(syncRequest(), env)).status).toBe(429)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('uses manual redirects and refuses to forward the code request to a redirect', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(null, { status: 307, headers: { Location: 'https://example.com' } }),
      )
    const env = { ACCOUNT_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) } }
    const request = new Request(`${origin}/api/arknights/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ server: 'en', email: 'doctor@example.com' }),
    })
    expect((await worker.fetch(request, env)).status).toBe(502)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      new URL('https://en-sdk-api.yostarplat.com/yostar/send-code'),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })
})
