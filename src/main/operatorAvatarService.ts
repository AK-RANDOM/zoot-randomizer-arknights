import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { PromotionArt } from '../shared/portraits'
import { skinAvatarFilename } from '../shared/portraits'
import { UPSTREAM } from '../shared/operatorData'
import { getOperatorDataset } from './operatorDataService'
import { avatarArtworkPaths, isArtworkPng } from './artworkStorage'

const avatarCache = new Map<string, string>()
export function clearAvatarMemoryCaches(): void {
  avatarCache.clear()
}

function validAvatarId(value: string): boolean {
  return /^[a-z0-9_@#+-]+$/i.test(value)
}

async function readAvatar(paths: readonly string[]): Promise<Buffer | null> {
  for (const path of paths) {
    try {
      const data = await readFile(path)
      if (isArtworkPng(data)) return data
    } catch {
      // An unavailable cache entry does not prevent trying the other location.
    }
  }
  return null
}

async function downloadAvatar(filename: string, path: string): Promise<Buffer | null> {
  const temporary = `${path}.${randomUUID()}.part`
  try {
    const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${encodeURIComponent(filename)}`, {
      headers: { 'User-Agent': 'arknights-randomizer' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return null
    const data = Buffer.from(await response.arrayBuffer())
    if (!isArtworkPng(data)) return null
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, data)
    await rename(temporary, path)
    return data
  } catch {
    return null
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

export async function getOperatorAvatarAsset(avatarId: string): Promise<string | null> {
  if (!validAvatarId(avatarId)) return null
  const cached = avatarCache.get(avatarId)
  if (cached) return cached

  const filename = skinAvatarFilename(avatarId)
  const paths = avatarArtworkPaths(filename)
  const data = (await readAvatar(paths)) ?? (await downloadAvatar(filename, paths[0]))
  if (!data) return null

  const image = `data:image/png;base64,${data.toString('base64')}`
  avatarCache.set(avatarId, image)
  return image
}

export async function getOperatorPromotionAvatar(
  operatorId: string,
  promotionArt: PromotionArt,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  if (promotionArt !== 'e1' && promotionArt !== 'e2') return null

  const dataset = await getOperatorDataset()
  const operator = dataset.operators.find((candidate) => candidate.id === operatorId)
  if (!operator) return null

  const arts = operator.defaultArts ?? []
  const preferred =
    promotionArt === 'e2'
      ? (arts.find((art) => art.phase === 2) ?? arts.at(-1))
      : (arts.find((art) => art.phase === 0) ?? arts[0])
  if (preferred) return getOperatorAvatarAsset(preferred.avatarId)

  const inferred = promotionArt === 'e1' ? operatorId : `${operatorId}_2`
  const fallback = await getOperatorAvatarAsset(inferred)
  if (fallback) return fallback
  return promotionArt === 'e2' ? getOperatorAvatarAsset(operatorId) : null
}

export async function getOperatorSkinAvatar(
  operatorId: string,
  skinId: string,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  const dataset = await getOperatorDataset()
  const operator = dataset.operators.find((candidate) => candidate.id === operatorId)
  const skin = operator?.skins?.find((candidate) => candidate.id === skinId)
  return skin?.avatarId ? getOperatorAvatarAsset(skin.avatarId) : null
}
