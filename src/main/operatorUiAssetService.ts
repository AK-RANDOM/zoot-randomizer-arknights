import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OperatorClass } from '../shared/operator'
import {
  CLASS_ICON_FILES,
  factionIconFile,
  subclassIconFile,
} from '../shared/operatorAssets'
import { getOperatorDataset } from './operatorDataService'

const cache = new Map<string, string | null>()

function bundledRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bundled-data', 'operators')
    : join(app.getAppPath(), 'resources', 'bundled-data', 'operators')
}

async function readPng(cacheKey: string, path: string): Promise<string | null> {
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null
  try {
    const data = await readFile(path)
    const url = `data:image/png;base64,${data.toString('base64')}`
    cache.set(cacheKey, url)
    return url
  } catch {
    cache.set(cacheKey, null)
    return null
  }
}

export async function getBundledClassIcon(operatorClass: OperatorClass): Promise<string | null> {
  const filename = CLASS_ICON_FILES[operatorClass]
  if (!filename) return null
  return readPng(`class:${operatorClass}`, join(bundledRoot(), 'class-icons', filename))
}

export async function getSubclassIcon(subclassId: string): Promise<string | null> {
  const filename = subclassIconFile(subclassId)
  if (!filename) return null
  return readPng(`subclass:${subclassId}`, join(bundledRoot(), 'subclass-icons', filename))
}

export async function getFactionIcon(factionId: string): Promise<string | null> {
  const dataset = await getOperatorDataset()
  const filename = factionIconFile(dataset.factionLabels[factionId])
  if (!filename) return null
  return readPng(`faction:${factionId}`, join(bundledRoot(), 'faction-icons', filename))
}
