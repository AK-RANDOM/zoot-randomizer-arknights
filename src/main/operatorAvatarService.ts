import { app } from 'electron'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import type { PromotionArt } from '../shared/portraits'
import { skinAvatarFilename } from '../shared/portraits'
import { UPSTREAM } from '../shared/operatorData'
import { getOperatorDataset } from './operatorDataService'

const avatarCache = new Map<string, string>()

function downloadedAvatarRoot(): string {
  return join(app.getPath('userData'), 'operator-data', 'appearance-avatars')
}

function validAvatarId(value: string): boolean {
  return /^[a-z0-9_@#+-]+$/i.test(value)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readAvatar(avatarId: string): Promise<string | null> {
  if (!validAvatarId(avatarId)) return null
  const path = join(downloadedAvatarRoot(), skinAvatarFilename(avatarId))
  if (!(await exists(path))) return null
  try {
    const data = await readFile(path)
    return `data:image/png;base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

async function downloadAvatar(avatarId: string): Promise<boolean> {
  if (!validAvatarId(avatarId)) return false
  const filename = skinAvatarFilename(avatarId)
  const path = join(downloadedAvatarRoot(), filename)
  if (await exists(path)) return true

  try {
    const response = await fetch(`${UPSTREAM.avatarBaseUrl}/${encodeURIComponent(filename)}`, {
      headers: { 'User-Agent': 'arknights-randomizer' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return false
    await mkdir(downloadedAvatarRoot(), { recursive: true })
    await writeFile(path, Buffer.from(await response.arrayBuffer()))
    return true
  } catch {
    return false
  }
}

export async function getOperatorAvatarAsset(avatarId: string): Promise<string | null> {
  if (!validAvatarId(avatarId)) return null
  const cached = avatarCache.get(avatarId)
  if (cached) return cached

  let image = await readAvatar(avatarId)
  if (!image && (await downloadAvatar(avatarId))) image = await readAvatar(avatarId)
  if (image) avatarCache.set(avatarId, image)
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
