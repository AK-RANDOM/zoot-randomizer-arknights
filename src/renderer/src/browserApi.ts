import type { DesktopApi } from '../../shared/desktop'
import { loadGarrisonEvents } from '../../shared/loadGarrisonEvents'
import type { OperatorDataset } from '../../shared/operator'
import { CLASS_ICON_FILES, factionIconFile, subclassIconFile } from '../../shared/operatorAssets'
import { operatorAvatarSourceFilename } from '../../shared/operatorAvatar'
import { gameDataExcelUrl, UPSTREAM } from '../../shared/operatorData'
import {
  PORTRAIT_SOURCE,
  portraitFilename,
  portraitResolutionOrder,
  skinAvatarFilename,
  skinPortraitFilename,
} from '../../shared/portraits'
import { bundledIconUrl } from './bundledIcons'
import {
  clearBrowserAccount,
  getBrowserAccount,
  requestBrowserLoginCode,
  syncBrowserAccount,
} from './browserAccount'

const dataRoot = `${import.meta.env.BASE_URL}operator-data/`
let datasetRequest: Promise<OperatorDataset> | undefined
const imageRequests = new Map<string, Promise<string | null>>()
const eventRequests = new Map<string, ReturnType<typeof loadGarrisonEvents>>()

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`)
  return (await response.json()) as T
}

function getOperatorDataset(): Promise<OperatorDataset> {
  datasetRequest ??= fetchJson<OperatorDataset>(`${dataRoot}operators.json`).catch(
    (error: unknown) => {
      datasetRequest = undefined
      throw error
    },
  )
  return datasetRequest
}

function imageUrl(base: string, filename: string | null): Promise<string | null> {
  if (!filename) return Promise.resolve(null)
  const url = `${base}/${encodeURIComponent(filename)}`
  const cached = imageRequests.get(url)
  if (cached) return cached
  const request = new Promise<string | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(url)
    image.onerror = () => resolve(null)
    image.src = url
  })
  imageRequests.set(url, request)
  return request
}

async function findOperator(operatorId: string) {
  return (await getOperatorDataset()).operators.find(({ id }) => id === operatorId)
}

const avatar = (avatarId: string) => imageUrl(UPSTREAM.avatarBaseUrl, skinAvatarFilename(avatarId))
const noOp = () => undefined
const unavailable = async (): Promise<never> => {
  throw new Error('This action is available in the Windows app.')
}

export const browserApi: DesktopApi = {
  platform: 'browser',
  getOperatorDataset,
  async getOperatorDataInfo() {
    const { generatedAt, operators, sources } = await getOperatorDataset()
    return { origin: 'bundled', generatedAt, operatorCount: operators.length, sources }
  },
  async getGarrisonEvents(region, locale) {
    const key = `${region}-${locale}`
    let request = eventRequests.get(key)
    if (!request) {
      request = loadGarrisonEvents(region, locale, (language, file) =>
        fetchJson(gameDataExcelUrl(language, file)),
      ).catch((error: unknown) => {
        eventRequests.delete(key)
        throw error
      })
      eventRequests.set(key, request)
    }
    const { events, localized } = await request
    if (!localized) eventRequests.delete(key)
    return events
  },
  getOperatorImage: (id) => imageUrl(UPSTREAM.avatarBaseUrl, operatorAvatarSourceFilename(id)),
  getOperatorAvatarAsset: avatar,
  async getOperatorPromotionAvatar(id, promotion) {
    const arts = (await findOperator(id))?.defaultArts ?? []
    const preferred =
      promotion === 'e2'
        ? (arts.find(({ phase }) => phase === 2) ?? arts.at(-1))
        : (arts.find(({ phase }) => phase === 0) ?? arts[0])
    const preferredUrl = await avatar(preferred?.avatarId ?? (promotion === 'e2' ? `${id}_2` : id))
    return preferredUrl ?? browserApi.getOperatorImage(id)
  },
  async getOperatorPortrait(id, promotion) {
    for (const phase of portraitResolutionOrder(id, promotion)) {
      const url = await imageUrl(PORTRAIT_SOURCE.baseUrl, portraitFilename(id, phase))
      if (url) return url
    }
    return null
  },
  async getOperatorSkinPortrait(id, skinId) {
    const skin = (await findOperator(id))?.skins?.find(({ id }) => id === skinId)
    return skin ? imageUrl(PORTRAIT_SOURCE.baseUrl, skinPortraitFilename(skin.portraitId)) : null
  },
  async getOperatorSkinAvatar(id, skinId) {
    const skin = (await findOperator(id))?.skins?.find(({ id }) => id === skinId)
    return skin?.avatarId ? avatar(skin.avatarId) : null
  },
  getClassIcon: async (operatorClass) =>
    bundledIconUrl('class-icons', CLASS_ICON_FILES[operatorClass]),
  getSubclassIcon: async (id) => bundledIconUrl('subclass-icons', subclassIconFile(id)),
  async getFactionIcon(id) {
    const { factionLabels } = await getOperatorDataset()
    return bundledIconUrl('faction-icons', factionIconFile(factionLabels[id]))
  },
  getImportedArknightsAccount: getBrowserAccount,
  getArknightsProfileAvatar: (id) =>
    imageUrl(
      'https://raw.githubusercontent.com/fexli/ArknightsResource/main/avatar/DEFAULT',
      `${id}.png`,
    ),
  setGarrisonCloseDirty: noOp,
  completeGarrisonCloseSave: noOp,
  onGarrisonCloseSaveRequested: () => noOp,
  onPortraitSyncProgress: () => noOp,
  checkOperatorUpdates: unavailable,
  updateOperatorData: unavailable,
  getArtworkStorageInfo: unavailable,
  openArtworkStorageFolder: unavailable,
  clearDownloadedArtwork: unavailable,
  startCompleteArtworkDownload: unavailable,
  getPortraitSyncProgress: unavailable,
  startPortraitSync: unavailable,
  cancelPortraitSync: unavailable,
  requestArknightsLoginCode: requestBrowserLoginCode,
  syncArknightsAccount: syncBrowserAccount,
  clearImportedArknightsAccount: clearBrowserAccount,
}
