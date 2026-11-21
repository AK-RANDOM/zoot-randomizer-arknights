import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { DataPackageClient, type DataPackageStorage } from '../shared/dataPackageClient.ts'
import { DATA_PACKAGE_PIN } from '../shared/dataPackagePin.ts'
import type { DataPackageChannelName } from '../shared/dataPackage.ts'
import { OPERATOR_DATA_PIPELINE_VERSION, type OperatorDataset } from '../shared/operator.ts'
import { upgradeLegacyOperatorDataset, validateOperatorDataset } from '../shared/operatorData.ts'
import { welfareAcquisitionOverride } from '../shared/acquisitionMetadata.ts'
import type { GarrisonEvent } from '../shared/garrisonEventCatalog.ts'

export function fileDataPackageStorage(userDataRoot: string): DataPackageStorage {
  const root = join(userDataRoot, 'data-packages')
  const target = join(root, 'cache.json')
  return {
    load: async () => readFile(target, 'utf8').catch(() => null),
    async save(value) {
      await mkdir(root, { recursive: true })
      const stage = join(root, `.update-${randomUUID()}.json`)
      try {
        const handle = await open(stage, 'wx')
        try {
          await handle.writeFile(value, 'utf8')
          await handle.sync()
        } finally {
          await handle.close()
        }
        // The complete roster and every catalog move together on the user's data volume.
        await rename(stage, target)
      } finally {
        await unlink(stage).catch(() => undefined)
      }
    },
  }
}

export async function readLegacyOperatorData(
  userDataRoot: string,
  bundled: OperatorDataset | null,
): Promise<OperatorDataset | null> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(join(userDataRoot, 'operator-data', 'operators.json'), 'utf8'),
    )
    const upgraded = upgradeLegacyOperatorDataset(parsed)
    const validation = validateOperatorDataset(upgraded, {
      requireSourceCommits: false,
      requireArtworkSourceCommit: false,
    })
    if (!validation.valid) return null
    const dataset = upgraded as OperatorDataset
    const oldPipeline = dataset.dataPipelineVersion !== OPERATOR_DATA_PIPELINE_VERSION
    const confirmed = new Map(
      bundled?.operators.map((operator) => [operator.id, operator.release.cn]),
    )
    return {
      ...dataset,
      operators: dataset.operators.map((operator) => ({
        ...operator,
        acquisition: welfareAcquisitionOverride(operator.id) ?? operator.acquisition,
        release: oldPipeline
          ? {
              ...operator.release,
              cn: operator.availableOn.cn
                ? (confirmed.get(operator.id) ?? { date: null, yearGroup: null })
                : { date: null, yearGroup: null },
            }
          : operator.release,
      })),
    }
  } catch {
    return null
  }
}

export function createDataPackageRepository(options: {
  bundledRoot: string
  userDataRoot: string
  baseUrl?: string
  channel?: DataPackageChannelName
  pin?: typeof DATA_PACKAGE_PIN | null
  fetchImpl?: typeof fetch
}): DataPackageClient {
  return new DataPackageClient({
    loadBundled: () => readFile(join(options.bundledRoot, 'data-package.json'), 'utf8'),
    bundledPin: options.pin === null ? undefined : (options.pin ?? DATA_PACKAGE_PIN),
    storage: fileDataPackageStorage(options.userDataRoot),
    baseUrl: options.baseUrl ?? DATA_PACKAGE_PIN.baseUrl,
    channel: async () => {
      if (options.channel) return options.channel
      try {
        const build = JSON.parse(
          await readFile(join(options.bundledRoot, 'data-package-build.json'), 'utf8'),
        ) as { channel?: unknown }
        if (build.channel === 'preview' || build.channel === 'production') return build.channel
      } catch {
        /* Older build markers use the selected default channel. */
      }
      return DATA_PACKAGE_PIN.updateChannel
    },
    fetchImpl: options.fetchImpl,
    loadLegacy: (bundled) => readLegacyOperatorData(options.userDataRoot, bundled),
    async loadLegacyCatalog(region, locale) {
      try {
        const cached = JSON.parse(
          await readFile(
            join(options.userDataRoot, `garrison-event-catalog-${region}-${locale}.json`),
            'utf8',
          ),
        ) as { version: number; events: GarrisonEvent[] }
        if (cached.version !== 14 || !Array.isArray(cached.events) || !cached.events.length)
          return null
        if (
          cached.events.some(
            (event) =>
              !event ||
              typeof event.id !== 'string' ||
              typeof event.name !== 'string' ||
              !event.stages ||
              (['standard', 'h', 'ex', 's'] as const).some(
                (type) =>
                  !Array.isArray(event.stages[type]) ||
                  event.stages[type].some((code) => typeof code !== 'string'),
              ),
          )
        )
          return null
        return cached.events
      } catch {
        return null
      }
    },
  })
}
