import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { upgradeLegacyOperatorDataset, validateOperatorDataset } from '../src/shared/operatorData.ts'
import {
  CLASS_ICON_FILES,
  factionIconFile,
  subclassIconFile,
} from '../src/shared/operatorAssets.ts'
import type { OperatorDataset } from '../src/shared/operator.ts'

const operatorRoot = join(process.cwd(), 'resources', 'bundled-data', 'operators')
const path = join(operatorRoot, 'operators.json')
const rawDataset = JSON.parse(await readFile(path, 'utf8')) as unknown
const legacy =
  rawDataset !== null &&
  typeof rawDataset === 'object' &&
  (rawDataset as { schemaVersion?: unknown }).schemaVersion === 4
const dataset = upgradeLegacyOperatorDataset(rawDataset)
const result = validateOperatorDataset(dataset, { requireSourceCommits: !legacy })

for (const warning of result.warnings) console.warn('Warning:', warning)

async function exists(pathname: string): Promise<boolean> {
  try {
    await access(pathname, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function validateUiAssets(value: OperatorDataset): Promise<string[]> {
  const errors: string[] = []
  const expected = [
    ...Object.values(CLASS_ICON_FILES).map((filename) => ['class-icons', filename] as const),
    ...value.operators
      .map((operator) => subclassIconFile(operator.subclass.id))
      .filter((filename): filename is string => filename !== null)
      .map((filename) => ['subclass-icons', filename] as const),
    ...Object.values(value.factionLabels)
      .map((label) => factionIconFile(label))
      .filter((filename): filename is string => filename !== null)
      .map((filename) => ['faction-icons', filename] as const),
  ]

  for (const [directory, filename] of [...new Map(expected.map((entry) => [`${entry[0]}/${entry[1]}`, entry])).values()]) {
    if (!(await exists(join(operatorRoot, directory, filename)))) {
      errors.push(`Missing bundled UI asset: ${directory}/${filename}`)
    }
  }
  return errors
}

if (!result.valid) {
  for (const error of result.errors) console.error('Error:', error)
  process.exitCode = 1
} else {
  const typedDataset = dataset as OperatorDataset
  const assetErrors = await validateUiAssets(typedDataset)
  if (assetErrors.length > 0) {
    for (const error of assetErrors) console.error('Error:', error)
    process.exitCode = 1
  } else {
    console.log('Bundled operator dataset valid:', typedDataset.operators.length, 'operators')
    console.log('Bundled class/subclass/faction UI assets valid')
  }
}
