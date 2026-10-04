import { app } from 'electron'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import type { OperatorUpdateResult } from '../shared/desktop'
import {
  PORTRAIT_SOURCE,
  portraitFilename,
  portraitResolutionOrder,
  usesAmiyaPromotionFallback,
  type PortraitPhase,
  type PromotionArt,
} from '../shared/portraits'
import { getOperatorDataset, updateOperatorData } from './operatorDataService'

const portraitCache = new Map<string, string | null>()

function bundledPortraitRoot(): string {
  const operatorRoot = app.isPackaged
    ? join(process.resourcesPath, 'bundled-data', 'operators')
    : join(app.getAppPath(), 'resources', 'bundled-data', 'operators')
  return join(operatorRoot, 'portraits')
}

function downloadedPortraitRoot(): string {
  return join(app.getPath('userData'), 'operator-data', 'portraits')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function localPortraitCandidates(operatorId: string, phase: PortraitPhase): string[] {
  const filename = portraitFilename(operatorId, phase)
  return [
    join(downloadedPortraitRoot(), filename),
    join(bundledPortraitRoot(), filename),
  ]
}

async function hasLocalPortrait(operatorId: string, phase: PortraitPhase): Promise<boolean> {
  for (const path of localPortraitCandidates(operatorId, phase)) {
    if (await exists(path)) return true
  }
  return false
}

async function readPortrait(operatorId: string, promotionArt: PromotionArt): Promise<string | null> {
  for (const phase of portraitResolutionOrder(operatorId, promotionArt)) {
    for (const path of localPortraitCandidates(operatorId, phase)) {
      if (!(await exists(path))) continue
      try {
        const data = await readFile(path)
        return `data:image/png;base64,${data.toString('base64')}`
      } catch {
        // Continue to the next valid promotion/source candidate.
      }
    }
  }
  return null
}

export async function getOperatorPortrait(
  operatorId: string,
  promotionArt: PromotionArt,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  if (promotionArt !== 'e1' && promotionArt !== 'e2') return null

  const dataset = await getOperatorDataset()
  if (!dataset.operators.some((operator) => operator.id === operatorId)) return null

  const cacheKey = `${operatorId}:${promotionArt}`
  if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey) ?? null

  const url = await readPortrait(operatorId, promotionArt)
  portraitCache.set(cacheKey, url)
  return url
}

async function downloadPortraitVariant(
  operatorId: string,
  phase: PortraitPhase,
): Promise<boolean> {
  if (await hasLocalPortrait(operatorId, phase)) return true

  try {
    const filename = portraitFilename(operatorId, phase)
    const response = await fetch(`${PORTRAIT_SOURCE.baseUrl}/${filename}`, {
      headers: { 'User-Agent': 'arknights-randomizer' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return false

    await mkdir(downloadedPortraitRoot(), { recursive: true })
    await writeFile(
      join(downloadedPortraitRoot(), filename),
      Buffer.from(await response.arrayBuffer()),
    )
    return true
  } catch {
    return false
  }
}

export async function syncOperatorPortraits(operatorIds: readonly string[]): Promise<string[]> {
  const warnings: string[] = []
  const batchSize = 6

  for (let index = 0; index < operatorIds.length; index += batchSize) {
    const batch = operatorIds.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (operatorId) => {
        const [e1, e2] = await Promise.all([
          downloadPortraitVariant(operatorId, 1),
          downloadPortraitVariant(operatorId, 2),
        ])
        return { operatorId, e1, e2 }
      }),
    )

    for (const result of results) {
      const e1Usable = result.e1 || (usesAmiyaPromotionFallback(result.operatorId) && result.e2)
      const e2Usable = result.e2 || e1Usable
      if (!e1Usable) warnings.push(`No E1 portrait found for ${result.operatorId}.`)
      if (!e2Usable) warnings.push(`No E2/E1 portrait found for ${result.operatorId}.`)
    }
  }

  portraitCache.clear()
  return warnings
}

export async function updateOperatorDataWithPortraits(): Promise<OperatorUpdateResult> {
  const result = await updateOperatorData()
  const portraitWarnings = await syncOperatorPortraits(
    result.dataset.operators.map((operator) => operator.id),
  )

  return {
    ...result,
    warnings: [...result.warnings, ...portraitWarnings],
  }
}
