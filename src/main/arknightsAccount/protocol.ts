import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto'
import type { ArknightsAccountServer } from '../../shared/arknightsAccount'

const NETWORK_CONFIG_URLS: Record<ArknightsAccountServer, string> = {
  en: 'https://ak-conf.arknights.global/config/prod/official/network_config',
  jp: 'https://ak-conf.arknights.jp/config/prod/official/network_config',
  kr: 'https://ak-conf.arknights.kr/config/prod/official/network_config',
}

const YOSTAR_DOMAINS: Record<ArknightsAccountServer, string> = {
  en: 'https://en-sdk-api.yostarplat.com',
  jp: 'https://jp-sdk-api.yostarplat.com',
  kr: 'https://jp-sdk-api.yostarplat.com',
}

const YOSTAR_SIGNING_SUFFIX = '886c085e4a8d30a703367b120dd8353948405ec2'
const U8_SIGNING_KEY = '91240f70c09a08a6bc72af1a5c8d4670'
const DEFAULT_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 11; KB2000 Build/RP1A.201005.001)'
const DEFAULT_UNITY_VERSION = '2017.4.39f1'

export interface ArknightsDeviceIds {
  deviceId: string
  deviceId2: string
  deviceId3: string
}

export interface ArknightsAccountProtocolOptions {
  fetch?: typeof fetch
  now?: () => number
  createDeviceIds?: () => ArknightsDeviceIds
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, message: string): JsonRecord {
  if (!isRecord(value)) throw new Error(message)
  return value
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(message)
  return value
}

function randomDigits(count: number): string {
  let value = ''
  for (let index = 0; index < count; index += 1) value += randomInt(0, 10).toString()
  return value
}

export function createEphemeralDeviceIds(): ArknightsDeviceIds {
  return {
    deviceId: randomUUID().replaceAll('-', ''),
    deviceId2: `86${randomDigits(13)}`,
    deviceId3: randomUUID().replaceAll('-', ''),
  }
}

function yostarHead(
  server: ArknightsAccountServer,
  deviceId: string,
  nowSeconds: number,
): JsonRecord {
  return {
    PID: server === 'en' ? 'US-ARKNIGHTS' : server === 'jp' ? 'JP-AK' : 'KR-ARKNIGHTS',
    Channel: 'googleplay',
    Platform: 'android',
    Version: '4.10.0',
    GVersionNo: '2000112',
    GBuildNo: '',
    Lang: server === 'en' ? 'en' : server === 'jp' ? 'jp' : 'ko',
    DeviceID: deviceId,
    DeviceModel: 'F9',
    UID: '',
    Token: '',
    Time: nowSeconds,
  }
}

export function createYostarAuthorization(
  server: ArknightsAccountServer,
  body: string,
  deviceId: string,
  nowSeconds: number,
): string {
  const head = yostarHead(server, deviceId, nowSeconds)
  const serializedHead = JSON.stringify(head)
  const sign = createHash('md5')
    .update(`${serializedHead}${body}${YOSTAR_SIGNING_SUFFIX}`)
    .digest('hex')
    .toUpperCase()
  return JSON.stringify({ Head: head, Sign: sign })
}

function formUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+')
}

export function createU8Sign(body: JsonRecord): string {
  const query = Object.entries(body)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${formUrlEncode(key)}=${formUrlEncode(String(value))}`)
    .join('&')
  return createHmac('sha1', U8_SIGNING_KEY).update(query).digest('hex').toLowerCase()
}

function joinUrl(base: string, endpoint: string): string {
  return `${base.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(`Arknights service returned a non-JSON response (${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(`Arknights service request failed with HTTP ${response.status}.`)
  }
  return data
}

export class ArknightsAccountProtocol {
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly createDeviceIds: () => ArknightsDeviceIds

  constructor(options: ArknightsAccountProtocolOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch
    this.now = options.now ?? Date.now
    this.createDeviceIds = options.createDeviceIds ?? createEphemeralDeviceIds
  }

  async requestLoginCode(server: ArknightsAccountServer, email: string): Promise<void> {
    const deviceIds = this.createDeviceIds()
    await this.yostarRequest(server, deviceIds.deviceId, 'yostar/send-code', {
      Account: email,
      Randstr: '',
      Ticket: '',
    })
  }

  async fetchSyncDataWithEmailCode(
    server: ArknightsAccountServer,
    email: string,
    code: string,
  ): Promise<unknown> {
    const deviceIds = this.createDeviceIds()

    const emailAuth = await this.yostarRequest(server, deviceIds.deviceId, 'yostar/get-auth', {
      Account: email,
      Code: code,
    })
    const emailToken = requireString(
      requireRecord(emailAuth['Data'], 'YoStar auth response is missing Data.')['Token'],
      'YoStar auth response token is invalid.',
    )

    const yostarLogin = await this.yostarRequest(server, deviceIds.deviceId, 'user/login', {
      CheckAccount: 0,
      Geetest: {
        CaptchaID: null,
        CaptchaOutput: null,
        GenTime: null,
        LotNumber: null,
        PassToken: null,
      },
      OpenID: email,
      Secret: '',
      Token: emailToken,
      Type: 'yostar',
      UserName: email,
    })
    const userInfo = requireRecord(
      requireRecord(yostarLogin['Data'], 'YoStar login response is missing Data.')['UserInfo'],
      'YoStar login response is missing UserInfo.',
    )
    const channelUid = requireString(userInfo['ID'], 'YoStar login response is missing user ID.')
    const channelToken = requireString(userInfo['Token'], 'YoStar login response is missing token.')

    const network = await this.loadNetworkConfig(server)
    const u8Response = await this.requestJson(joinUrl(network.u8, 'user/v1/getToken'), {
      method: 'POST',
      body: JSON.stringify(this.createU8Body(channelUid, channelToken, deviceIds)),
      headers: this.defaultGameHeaders(),
    })
    const u8 = requireRecord(u8Response, 'Arknights u8 response is invalid.')
    this.assertGameResult(u8)
    const uid = requireString(u8['uid'], 'Arknights u8 response is missing uid.')
    const u8Token = requireString(u8['token'], 'Arknights u8 response is missing token.')

    const version = await this.loadVersionConfig(network.hv)
    const loginResponse = await this.requestJson(joinUrl(network.gs, 'account/login'), {
      method: 'POST',
      body: JSON.stringify({
        platform: 1,
        networkVersion: '1',
        assetsVersion: version.resVersion,
        clientVersion: version.clientVersion,
        token: u8Token,
        uid,
        deviceId: deviceIds.deviceId,
        deviceId2: deviceIds.deviceId2,
        deviceId3: deviceIds.deviceId3,
      }),
      headers: {
        ...this.defaultGameHeaders(),
        secret: '',
        seqnum: '1',
        uid,
      },
    })
    const login = requireRecord(loginResponse, 'Arknights login response is invalid.')
    this.assertGameResult(login)
    const secret = requireString(login['secret'], 'Arknights login response is missing secret.')

    const syncResponse = await this.requestJson(joinUrl(network.gs, 'account/syncData'), {
      method: 'POST',
      body: JSON.stringify({ platform: 1 }),
      headers: {
        ...this.defaultGameHeaders(),
        secret,
        seqnum: '2',
        uid,
      },
    })
    const sync = requireRecord(syncResponse, 'Arknights syncData response is invalid.')
    this.assertGameResult(sync)
    return sync
  }

  private async yostarRequest(
    server: ArknightsAccountServer,
    deviceId: string,
    endpoint: string,
    data: JsonRecord,
  ): Promise<JsonRecord> {
    const body = JSON.stringify(data)
    const response = await this.requestJson(joinUrl(YOSTAR_DOMAINS[server], endpoint), {
      method: 'POST',
      body,
      headers: {
        Authorization: createYostarAuthorization(
          server,
          body,
          deviceId,
          Math.floor(this.now() / 1000),
        ),
        'Content-Type': 'application/json',
      },
    })
    const parsed = requireRecord(response, 'YoStar response is invalid.')
    if (parsed['Code'] !== 200) throw new Error('YoStar authentication request was rejected.')
    return parsed
  }

  private async loadNetworkConfig(server: ArknightsAccountServer): Promise<{
    gs: string
    u8: string
    hv: string
  }> {
    const response = requireRecord(
      await this.requestJson(NETWORK_CONFIG_URLS[server], {
        method: 'GET',
        headers: this.defaultGameHeaders(),
      }),
      'Arknights network configuration response is invalid.',
    )
    const content = requireString(
      response['content'],
      'Arknights network configuration is missing content.',
    )

    let parsedContent: unknown
    try {
      parsedContent = JSON.parse(content)
    } catch {
      throw new Error('Arknights network configuration content is not valid JSON.')
    }
    const config = requireRecord(
      parsedContent,
      'Arknights network configuration content is invalid.',
    )
    const funcVer = requireString(
      config['funcVer'],
      'Arknights network configuration is missing funcVer.',
    )
    const configs = requireRecord(
      config['configs'],
      'Arknights network configuration is missing configs.',
    )
    const active = requireRecord(
      configs[funcVer],
      'Arknights network configuration has no active config.',
    )
    const network = requireRecord(
      active['network'],
      'Arknights network configuration is missing network routes.',
    )

    return {
      gs: requireString(network['gs'], 'Arknights network configuration is missing gs route.'),
      u8: requireString(network['u8'], 'Arknights network configuration is missing u8 route.'),
      hv: requireString(network['hv'], 'Arknights network configuration is missing hv route.'),
    }
  }

  private async loadVersionConfig(
    hv: string,
  ): Promise<{ resVersion: string; clientVersion: string }> {
    const response = requireRecord(
      await this.requestJson(hv.replace('{0}', 'Android'), {
        method: 'GET',
        headers: this.defaultGameHeaders(),
      }),
      'Arknights version response is invalid.',
    )
    return {
      resVersion: requireString(
        response['resVersion'],
        'Arknights version response is missing resVersion.',
      ),
      clientVersion: requireString(
        response['clientVersion'],
        'Arknights version response is missing clientVersion.',
      ),
    }
  }

  private createU8Body(
    channelUid: string,
    channelToken: string,
    deviceIds: ArknightsDeviceIds,
  ): JsonRecord {
    const body: JsonRecord = {
      appId: '1',
      platform: 1,
      channelId: '3',
      subChannel: '3',
      extension: JSON.stringify({ type: 1, uid: channelUid, token: channelToken }),
      worldId: '3',
      deviceId: deviceIds.deviceId,
      deviceId2: deviceIds.deviceId2,
      deviceId3: deviceIds.deviceId3,
    }
    return { ...body, sign: createU8Sign(body) }
  }

  private defaultGameHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Unity-Version': DEFAULT_UNITY_VERSION,
      'User-Agent': DEFAULT_USER_AGENT,
      Connection: 'Keep-Alive',
    }
  }

  private assertGameResult(data: JsonRecord): void {
    if (typeof data['result'] === 'number' && data['result'] !== 0) {
      throw new Error(`Arknights game service rejected the request (result ${data['result']}).`)
    }
    if (data['error']) throw new Error('Arknights game service returned an error.')
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(url, init)
    return parseJsonResponse(response)
  }
}
