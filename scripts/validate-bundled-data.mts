import { buildArtworkInventory } from '../src/shared/artworkInventory.ts'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import {
  upgradeLegacyOperatorDataset,
  validateOperatorDataset,
} from '../src/shared/operatorData.ts'
import {
  CLASS_ICON_FILES,
  factionIconFile,
  subclassIconFile,
} from '../src/shared/operatorAssets.ts'
import type { OperatorDataset } from '../src/shared/operator.ts'
import { DATA_PACKAGE_PIN } from '../src/shared/dataPackagePin.ts'
import { parseDataPackageArtifact } from '../src/shared/dataPackageDistribution.ts'
import { dataSha256, canonicalPackageJson } from '../src/shared/dataPackageJson.ts'

const operatorRoot = join(process.cwd(), 'resources', 'bundled-data', 'operators')
const path = join(operatorRoot, 'operators.json')
const rawDataset = JSON.parse(await readFile(path, 'utf8')) as unknown
const legacy =
  rawDataset !== null &&
  typeof rawDataset === 'object' &&
  (rawDataset as { schemaVersion?: unknown }).schemaVersion === 4
const dataset = upgradeLegacyOperatorDataset(rawDataset)
const result = validateOperatorDataset(dataset, {
  requireSourceCommits: !legacy,
  requireArtworkSourceCommit: false,
})
const artifactBody = await readFile(join(operatorRoot, '..', 'data-package.json'), 'utf8')
if (
  dataSha256(artifactBody) !== DATA_PACKAGE_PIN.artifactSha256 ||
  Buffer.byteLength(artifactBody) !== DATA_PACKAGE_PIN.artifactBytes
)
  throw new Error('Bundled data differs from the source-controlled package selection.')
const artifact = parseDataPackageArtifact(artifactBody, DATA_PACKAGE_PIN.packageId)
const expectedArtwork = buildArtworkInventory(
  JSON.parse(artifact.files['operators.json']) as OperatorDataset,
  DATA_PACKAGE_PIN.packageId,
)
if (
  (await readFile(join(operatorRoot, '..', 'artwork-inventory.json'), 'utf8')) !==
  canonicalPackageJson(expectedArtwork)
)
  throw new Error('Bundled artwork inventory differs from selected sources and roster.')
if ((await readFile(path, 'utf8')) !== artifact.files['operators.json'])
  throw new Error('Legacy build export differs from its prepared package.')

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

  for (const [directory, filename] of [
    ...new Map(expected.map((entry) => [`${entry[0]}/${entry[1]}`, entry])).values(),
  ]) {
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
