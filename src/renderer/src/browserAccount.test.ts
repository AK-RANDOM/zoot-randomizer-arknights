import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const service = 'https://account.example'
const snapshot = { schemaVersion: 1, operators: [], ownedSkinIds: [], server: 'en' }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_WEB_ACCOUNT_API_ORIGIN', service)
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('browser account service', () => {
  it('sends login requests to the configured service without cookies', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}))
    vi.stubGlobal('fetch', fetch)
    const { requestBrowserLoginCode } = await import('./browserAccount')
    await requestBrowserLoginCode('en', 'doctor@example.com')
    expect(String(fetch.mock.calls[0][0])).toBe(`${service}/api/arknights/send-code`)
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify({ server: 'en', email: 'doctor@example.com' }),
    })
  })

  it('retains the last imported snapshot after a failed refresh and supports unlinking', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ snapshot }))
      .mockResolvedValueOnce(Response.json({ error: 'Invalid code' }, { status: 502 }))
    vi.stubGlobal('fetch', fetch)
    const { syncBrowserAccount, getBrowserAccount, clearBrowserAccount } =
      await import('./browserAccount')
    await syncBrowserAccount('en', 'doctor@example.com', '123456')
    expect(String(fetch.mock.calls[0][0])).toBe(`${service}/api/arknights/sync`)
    expect(await getBrowserAccount()).toEqual(snapshot)
    await expect(syncBrowserAccount('en', 'doctor@example.com', '654321')).rejects.toThrow(
      'Invalid code',
    )
    expect(await getBrowserAccount()).toEqual(snapshot)
    await clearBrowserAccount()
    expect(await getBrowserAccount()).toBeNull()
  })

  it('rejects an insecure service before sending the email or code', async () => {
    vi.stubEnv('VITE_WEB_ACCOUNT_API_ORIGIN', 'http://account.example')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { requestBrowserLoginCode } = await import('./browserAccount')
    await expect(requestBrowserLoginCode('en', 'doctor@example.com')).rejects.toThrow(
      'requires HTTPS',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
