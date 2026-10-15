import { describe, expect, it, vi } from 'vitest'
import { ArknightsAccountProtocol, createU8Sign, createYostarAuthorization } from './protocol'

const DEVICE_IDS = {
  deviceId: '11111111111111111111111111111111',
  deviceId2: '861234567890123',
  deviceId3: '33333333333333333333333333333333',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Arknights account protocol', () => {
  it('creates stable YoStar authorization for a fixed clock/device/body', () => {
    const body = JSON.stringify({ Account: 'doctor@example.com', Randstr: '', Ticket: '' })
    const authorization = JSON.parse(
      createYostarAuthorization('en', body, DEVICE_IDS.deviceId, 1_700_000_000),
    ) as { Head: Record<string, unknown>; Sign: string }

    expect(authorization.Head).toMatchObject({
      PID: 'US-ARKNIGHTS',
      Channel: 'googleplay',
      Platform: 'android',
      DeviceID: DEVICE_IDS.deviceId,
      Time: 1_700_000_000,
    })
    expect(authorization.Sign).toMatch(/^[A-F0-9]{32}$/)
  })

  it('matches Python urllib form encoding used by the u8 signing protocol', () => {
    expect(createU8Sign({ b: 'a b!()*', a: 1 })).toBe('7fcf86ad792437545cb7c8429a9418475e74a96d')
    expect(createU8Sign({ b: 2, a: 1 })).toBe(createU8Sign({ a: 1, b: 2 }))
  })

  it('requests a YoStar verification code without returning credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ Code: 200, Data: {} }))
    const protocol = new ArknightsAccountProtocol({
      fetch: fetchMock,
      now: () => 1_700_000_000_000,
      createDeviceIds: () => DEVICE_IDS,
    })

    await expect(protocol.requestLoginCode('en', 'doctor@example.com')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://en-sdk-api.yostarplat.com/yostar/send-code')
    expect(JSON.parse(String(init?.body))).toEqual({
      Account: 'doctor@example.com',
      Randstr: '',
      Ticket: '',
    })
  })

  it('completes email auth through syncData while keeping credentials internal', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ Code: 200, Data: { Token: 'email-token' } }))
      .mockResolvedValueOnce(
        jsonResponse({
          Code: 200,
          Data: { UserInfo: { ID: 'channel-uid', Token: 'channel-token' } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          content: JSON.stringify({
            funcVer: 'V1',
            configs: {
              V1: {
                network: {
                  gs: 'https://game.example',
                  u8: 'https://auth.example/u8',
                  hv: 'https://static.example/{0}/version',
                },
              },
            },
          }),
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ result: 0, uid: 'player-uid', token: 'u8-token' }))
      .mockResolvedValueOnce(jsonResponse({ resVersion: 'res-1', clientVersion: 'client-1' }))
      .mockResolvedValueOnce(jsonResponse({ result: 0, secret: 'session-secret' }))
      .mockResolvedValueOnce(
        jsonResponse({
          result: 0,
          user: {
            troop: {
              chars: {
                '1': { charId: 'char_103_angel', level: 90, evolvePhase: 2 },
              },
            },
            skin: { characterSkins: { 'char_103_angel@skin#1': true } },
          },
        }),
      )

    const protocol = new ArknightsAccountProtocol({
      fetch: fetchMock,
      now: () => 1_700_000_000_000,
      createDeviceIds: () => DEVICE_IDS,
    })
    const result = await protocol.fetchSyncDataWithEmailCode('en', 'doctor@example.com', '123456')

    expect(result).toMatchObject({
      user: {
        troop: { chars: { '1': { charId: 'char_103_angel' } } },
      },
    })
    expect(JSON.stringify(result)).not.toContain('email-token')
    expect(JSON.stringify(result)).not.toContain('channel-token')
    expect(JSON.stringify(result)).not.toContain('u8-token')
    expect(JSON.stringify(result)).not.toContain('session-secret')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://en-sdk-api.yostarplat.com/yostar/get-auth',
      'https://en-sdk-api.yostarplat.com/user/login',
      'https://ak-conf.arknights.global/config/prod/official/network_config',
      'https://auth.example/u8/user/v1/getToken',
      'https://static.example/Android/version',
      'https://game.example/account/login',
      'https://game.example/account/syncData',
    ])

    const syncInit = fetchMock.mock.calls[6][1]
    expect(syncInit?.headers).toMatchObject({
      uid: 'player-uid',
      secret: 'session-secret',
      seqnum: '2',
    })
  })
})
