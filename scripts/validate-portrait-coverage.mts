import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateOperatorDataset } from '../src/shared/operatorData.ts'
import { resolvePortraitFilename } from '../src/shared/portraits.ts'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const operatorRoot = join(projectRoot, 'resources', 'bundled-data', 'operators')
const datasetPath = join(operatorRoot, 'operators.json')
const portraitDir = join(operatorRoot, 'portraits')

async function main(): Promise<void> {
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'))
  const datasetValidation = validateOperatorDataset(dataset, { requireSourceCommits: true })
  if (!datasetValidation.valid) {
    throw new Error(`Bundled dataset failed validation:\n${datasetValidation.errors.join('\n')}`)
  }

  let entries: string[]
  try {
    entries = await readdir(portraitDir)
  } catch {
    throw new Error('Bundled portrait directory is missing. Run npm run data:images first.')
  }

  const files = new Set(entries)
  const errors: string[] = []

  for (const operator of dataset.operators as Array<{ id: string }>) {
    const e1 = resolvePortraitFilename(operator.id, 'e1', files)
    const e2 = resolvePortraitFilename(operator.id, 'e2', files)

    if (!e1) errors.push(`${operator.id}: no valid E1 portrait`)
    if (!e2) errors.push(`${operator.id}: no valid E2/E1 fallback portrait`)

    for (const filename of new Set([e1, e2].filter((value): value is string => Boolean(value)))) {
      const info = await stat(join(portraitDir, filename))
      if (!info.isFile() || info.size === 0) {
        errors.push(`${operator.id}: portrait ${filename} is empty or not a file`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Portrait coverage validation failed:\n${errors.join('\n')}`)
  }

  console.log(`Portrait coverage valid for ${dataset.operators.length} playable operators.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
