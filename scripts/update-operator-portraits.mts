import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateOperatorDataset } from '../src/shared/operatorData.ts'
import {
  PORTRAIT_SOURCE,
  portraitFilename,
  resolvePortraitFilename,
  type PortraitPhase,
} from '../src/shared/portraits.ts'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const operatorRoot = join(projectRoot, 'resources', 'bundled-data', 'operators')
const datasetPath = join(operatorRoot, 'operators.json')
const portraitDir = join(operatorRoot, 'portraits')

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function downloadVariant(operatorId: string, phase: PortraitPhase): Promise<boolean> {
  const filename = portraitFilename(operatorId, phase)
  const destination = join(portraitDir, filename)
  if (await fileExists(destination)) return true

  try {
    const response = await fetch(`${PORTRAIT_SOURCE.baseUrl}/${filename}`, {
      headers: { 'User-Agent': 'arknights-randomizer-data-updater' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return false
    await writeFile(destination, Buffer.from(await response.arrayBuffer()))
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'))
  const validation = validateOperatorDataset(dataset, { requireSourceCommits: true })
  if (!validation.valid) {
    throw new Error(`Bundled dataset failed validation:\n${validation.errors.join('\n')}`)
  }

  await mkdir(portraitDir, { recursive: true })
  const operatorIds = dataset.operators.map((operator: { id: string }) => operator.id)
  const batchSize = 6

  for (let index = 0; index < operatorIds.length; index += batchSize) {
    const batch = operatorIds.slice(index, index + batchSize)
    await Promise.all(
      batch.flatMap((operatorId: string) => [
        downloadVariant(operatorId, 1),
        downloadVariant(operatorId, 2),
      ]),
    )
    process.stdout.write(
      `\rDownloaded/checked portraits: ${Math.min(index + batchSize, operatorIds.length)}/${operatorIds.length}`,
    )
  }
  process.stdout.write('\n')

  const files = new Set(await readdir(portraitDir))
  const missing = operatorIds.filter(
    (operatorId: string) =>
      !resolvePortraitFilename(operatorId, 'e1', files) ||
      !resolvePortraitFilename(operatorId, 'e2', files),
  )

  if (missing.length > 0) {
    throw new Error(
      `Portrait coverage is incomplete for ${missing.length} operator(s): ${missing.join(', ')}`,
    )
  }

  console.log(`Validated portrait coverage for ${operatorIds.length} playable operators.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
