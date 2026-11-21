import type {
  GameLocale,
  OperatorDataset,
  OperatorDatasetSources,
  ReleaseServer,
} from './operator.ts'
import type { GarrisonEvent } from './garrisonEventCatalog.ts'
import type { DataPackageArtifact, DataPackageChannelName } from './dataPackage.ts'
import type { OperatorDataInfo, OperatorUpdateCheck, OperatorUpdateResult } from './desktop.ts'
import { canonicalPackageJson } from './dataPackageFormat.ts'
import { confirmedDateRegressions } from './dataPackageValidation.ts'
import {
  digestData,
  fetchDataChannel,
  fetchDataPackage,
  IncompatibleDataPackageError,
  MAX_DATA_PACKAGE_BYTES,
  readDataPackage,
  type ReadDataPackage,
} from './dataPackageReader.ts'

export interface DataPackageStorage {
  load(): Promise<string | null>
  save(value: string): Promise<void>
}
interface SavedPackage {
  installedAgainst: string
  origin: 'bundled' | 'downloaded'
  artifact: DataPackageArtifact
}
interface SavedPackages {
  formatVersion: 1
  current: SavedPackage
  previous: SavedPackage | null
}
interface ActiveData {
  read: ReadDataPackage | null
  dataset: OperatorDataset
  origin: 'bundled' | 'downloaded'
  warning?: string
  saved?: SavedPackage
}

function sourcesFromChannel(
  sources: DataPackageArtifact['manifest']['sources'],
): OperatorDatasetSources {
  const game = sources.gamedata.commit
  return {
    gamedataCnCommit: game,
    gamedataEnCommit: game,
    gamedataJpCommit: game,
    gamedataKrCommit: game,
    gamedataTwCommit: game,
    resourcesCommit: null,
    releaseMetadataCommit: sources.releaseMetadata.commit,
  }
}

export class DataPackageClient {
  private active: ActiveData | null = null
  private bundled: ReadDataPackage | null = null
  private loading: Promise<ActiveData> | null = null
  private updating: Promise<OperatorUpdateResult> | null = null

  constructor(
    private readonly options: {
      loadBundled(): Promise<string>
      bundledPin?: { packageId: string; artifactSha256: string; artifactBytes: number }
      storage: DataPackageStorage
      baseUrl: string
      channel: DataPackageChannelName | (() => Promise<DataPackageChannelName>)
      fetchImpl?: typeof fetch
      cacheBundled?: boolean
      loadLegacy?: (bundled: OperatorDataset | null) => Promise<OperatorDataset | null>
      loadLegacyCatalog?: (
        region: ReleaseServer,
        locale: GameLocale,
      ) => Promise<GarrisonEvent[] | null>
    },
  ) {}

  private async load(): Promise<ActiveData> {
    if (this.active) return this.active
    this.loading ??= this.initialize().catch((error: unknown) => {
      this.loading = null
      throw error
    })
    return this.loading
  }

  private async initialize(): Promise<ActiveData> {
    try {
      const body = await this.options.loadBundled()
      const pin = this.options.bundledPin
      if (
        pin &&
        (new TextEncoder().encode(body).byteLength !== pin.artifactBytes ||
          (await digestData(body)) !== pin.artifactSha256)
      )
        throw new Error('Bundled package differs from its build selection.')
      this.bundled = await readDataPackage(body)
      if (pin && this.bundled.artifact.manifest.packageId !== pin.packageId)
        throw new Error('Bundled package identity differs from its build selection.')
    } catch {
      this.bundled = null
    }

    const candidates: ActiveData[] = []
    try {
      const body = await this.options.storage.load()
      if (body && new TextEncoder().encode(body).byteLength <= MAX_DATA_PACKAGE_BYTES * 2 + 65536) {
        const saved = JSON.parse(body) as Partial<SavedPackages>
        if (saved.formatVersion === 1)
          for (const record of [saved.current, saved.previous]) {
            try {
              if (
                !record ||
                !/^sha256:[a-f0-9]{64}$/.test(record.installedAgainst) ||
                !['bundled', 'downloaded'].includes(record.origin)
              )
                continue
              const read = await readDataPackage(record.artifact)
              candidates.push({ read, dataset: read.dataset, origin: record.origin, saved: record })
            } catch {
              /* Try the previous complete package before bundled data. */
            }
          }
      }
    } catch {
      /* Missing, corrupt or unavailable cache does not prevent bundled startup. */
    }

    const bundle = this.bundled
    const selected = candidates.find(
      (candidate) =>
        !bundle ||
        candidate.saved?.installedAgainst === bundle.artifact.manifest.packageId ||
        Date.parse(candidate.dataset.generatedAt ?? '') >
          Date.parse(bundle.dataset.generatedAt ?? '') ||
        candidate.dataset.operators.some(
          (operator) => !bundle.dataset.operators.some((item) => item.id === operator.id),
        ),
    )
    let active: ActiveData | null =
      selected ??
      (bundle
        ? { read: bundle, dataset: bundle.dataset, origin: 'bundled' }
        : (candidates[0] ?? null))

    // Unversioned legacy metadata is retained read-only until a complete package replaces it.
    // It cannot provide source-stamped catalogs; its old catalog is an explicitly labelled bridge.
    if (!candidates.length && this.options.loadLegacy) {
      const legacy = await this.options.loadLegacy(bundle?.dataset ?? null).catch(() => null)
      if (
        legacy &&
        (!active ||
          Date.parse(legacy.generatedAt ?? '') > Date.parse(active.dataset.generatedAt ?? '') ||
          legacy.operators.some(
            (operator) => !active!.dataset.operators.some((item) => item.id === operator.id),
          ))
      ) {
        active = {
          read: null,
          dataset: legacy,
          origin: 'downloaded',
          warning:
            'Using previously downloaded operator data until a complete data package is available.',
        }
      }
    }
    if (!active)
      throw new Error(
        'No valid local data is available. Reinstall the app or restore a complete data package.',
      )
    if (this.options.cacheBundled && active.read === bundle && bundle && !candidates.length) {
      const current: SavedPackage = {
        installedAgainst: bundle.artifact.manifest.packageId,
        origin: 'bundled',
        artifact: bundle.artifact,
      }
      try {
        await this.options.storage.save(
          canonicalPackageJson({ formatVersion: 1, current, previous: null }),
        )
        active.saved = current
      } catch {
        /* Browsing remains available when persistent storage is blocked. */
      }
    }
    this.active = active
    return active
  }

  async getDataset(): Promise<OperatorDataset> {
    return (await this.load()).dataset
  }

  async getInfo(): Promise<OperatorDataInfo> {
    const active = await this.load()
    return {
      origin: active.origin,
      generatedAt: active.dataset.generatedAt,
      operatorCount: active.dataset.operators.length,
      sources: active.dataset.sources,
      packageId: active.read?.artifact.manifest.packageId,
      warning: active.warning,
    }
  }

  async getCatalog(region: ReleaseServer, locale: GameLocale): Promise<GarrisonEvent[]> {
    const active = await this.load()
    if (active.read)
      return active.read.catalogs.find(
        (catalog) => catalog.region === region && catalog.locale === locale,
      )!.events
    const legacy = await this.options.loadLegacyCatalog?.(region, locale).catch(() => null)
    if (legacy?.length) return legacy
    const fallback = this.bundled?.catalogs.find(
      (catalog) => catalog.region === region && catalog.locale === locale,
    )
    if (fallback) return fallback.events
    throw new Error(
      'Event data is unavailable offline. Install a complete data update to restore it.',
    )
  }

  private async channel(): Promise<DataPackageChannelName> {
    return typeof this.options.channel === 'function'
      ? this.options.channel()
      : this.options.channel
  }

  async checkUpdates(): Promise<OperatorUpdateCheck> {
    const active = await this.load()
    try {
      const pointer = await fetchDataChannel(
        this.options.baseUrl,
        await this.channel(),
        this.options.fetchImpl,
      )
      const updateAvailable = active.read?.artifact.manifest.packageId !== pointer.packageId
      return {
        online: true,
        updateAvailable,
        current: active.dataset.sources,
        latest: sourcesFromChannel(pointer.sources),
        message: updateAvailable
          ? 'Updated operator and event data is available.'
          : 'Operator and event data is up to date.',
      }
    } catch (error) {
      return {
        online: error instanceof IncompatibleDataPackageError,
        updateAvailable: false,
        current: active.dataset.sources,
        latest: null,
        message:
          error instanceof IncompatibleDataPackageError
            ? error.message
            : 'Unable to reach the update source. Your local data remains available.',
      }
    }
  }

  async installUpdate(): Promise<OperatorUpdateResult> {
    if (this.updating) return this.updating
    this.updating = this.install().finally(() => {
      this.updating = null
    })
    return this.updating
  }

  private async install(): Promise<OperatorUpdateResult> {
    const active = await this.load()
    const pointer = await fetchDataChannel(
      this.options.baseUrl,
      await this.channel(),
      this.options.fetchImpl,
    )
    if (active.read?.artifact.manifest.packageId === pointer.packageId)
      return { updated: false, dataset: active.dataset, warnings: [] }
    const next = await fetchDataPackage(this.options.baseUrl, pointer, this.options.fetchImpl)
    const regressions = confirmedDateRegressions(active.dataset, next.dataset)
    const known = new Set(next.dataset.operators.map((operator) => operator.id))
    if (regressions.length || active.dataset.operators.some((operator) => !known.has(operator.id)))
      throw new Error(
        'This update would lose existing operator data. Your current data has been kept.',
      )
    const bundledId = this.bundled?.artifact.manifest.packageId ?? next.artifact.manifest.packageId
    const current: SavedPackage = {
      installedAgainst: bundledId,
      origin: 'downloaded',
      artifact: next.artifact,
    }
    const previous = active.read
      ? (active.saved ?? {
          installedAgainst: bundledId,
          origin: active.origin,
          artifact: active.read.artifact,
        })
      : null
    const saved: SavedPackages = { formatVersion: 1, current, previous }
    // A failed write leaves both the previous on-disk record and the active in-memory data usable.
    await this.options.storage.save(canonicalPackageJson(saved))
    this.active = { read: next, dataset: next.dataset, origin: 'downloaded', saved: current }
    return { updated: true, dataset: next.dataset, warnings: next.warnings }
  }
}
