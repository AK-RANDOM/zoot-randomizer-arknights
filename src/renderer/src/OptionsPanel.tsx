import { useEffect, useState } from 'react'
import type { ArtworkStorageInfo, PortraitSyncProgress } from '../../shared/desktop'
import type { OperatorPreferences, PoolPresentationMode } from '../../shared/operatorPool'
import {
  gameLocales,
  type GameLocale,
  type OperatorDataset,
  type ReleaseServer,
} from '../../shared/operator'
import ArknightsAccountPanel from './ArknightsAccountPanel'
import { GAME_LOCALE_LABELS } from '../../shared/gameLocalization'
import {
  setDraftActionConfirmationPreference,
  useDraftActionConfirmationPreference,
} from './draftConfirmationPreferences'

const presentationLabels: Record<PoolPresentationMode, string> = {
  imageGrid: 'Grid — Image only',
  compactCard: 'Compact card',
  simpleList: 'Simple list',
  detailedList: 'Detailed list',
}

function ArtworkDownloadStatus(): React.JSX.Element {
  const [progress, setProgress] = useState<PortraitSyncProgress | null>(null)
  const [storage, setStorage] = useState<ArtworkStorageInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refreshStorage = (): void => {
    void window.desktop.getArtworkStorageInfo().then(setStorage).catch((e: unknown) => setError(String(e)))
  }
  const run = (task: () => Promise<unknown>): void => {
    setError(null)
    void task().then(refreshStorage).catch((e: unknown) => setError(String(e)))
  }

  useEffect(() => {
    let active = true
    refreshStorage()
    void window.desktop.getPortraitSyncProgress().then((next) => {
      if (active) { setProgress(next); if (next.status !== 'downloading') refreshStorage() }
    })
    const unsubscribe = window.desktop.onPortraitSyncProgress((next) => {
      if (active) { setProgress(next); if (next.status !== 'downloading') refreshStorage() }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (!progress) {
    return <div className="artwork-download-status">Checking artwork cache…</div>
  }

  const downloading = progress.status === 'downloading'
  const canRetry = progress.status === 'cancelled' || progress.status === 'failed'
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="artwork-download-status" aria-live="polite">
      <div className="artwork-download-status__heading">
        <strong>Data &amp; Storage</strong>
        <small>{storage ? `${storage.totalFiles.toLocaleString()} cached images · ${(storage.totalBytes / 1024 ** 3).toFixed(2)} GiB` : 'Checking cache…'}</small>
      </div>
      <div className="bulk-appearance-control">
        <button type="button" className="secondary-button" disabled={downloading} onClick={() => run(() => window.desktop.startCompleteArtworkDownload())}>Download All / Resume</button>
        <button type="button" className="secondary-button" onClick={() => run(() => window.desktop.openArtworkStorageFolder())}>Open Folder</button>
        <button type="button" className="secondary-button" disabled={downloading} onClick={() => {
          if (window.confirm('Delete downloaded artwork? Bundled assets and personal data will be preserved.')) run(() => window.desktop.clearDownloadedArtwork())
        }}>Clear Cache</button>
      </div>
      <details>
        <summary>Storage details</summary>
        <small>Location: {storage?.path ?? 'Loading…'}</small>
        {storage?.categories.map((category) => <div key={category.name}><small>{category.name}: {category.files.toLocaleString()} files · {(category.bytes / 1024 ** 2).toFixed(1)} MiB</small></div>)}
      </details>
      {storage?.warning && <p role="alert">{storage.warning}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="artwork-download-status__heading">
        <div>
          <strong>Offline artwork cache</strong>
          <p>{progress.message}</p>
        </div>
        {downloading && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.desktop.cancelPortraitSync().then(setProgress)}
          >
            Cancel
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => run(() => window.desktop.startCompleteArtworkDownload())}
          >
            Retry
          </button>
        )}
      </div>
      {downloading && (
        <>
          <progress value={progress.completed} max={Math.max(progress.total, 1)} />
          <small>
            {progress.completed} / {progress.total} assets · {percent}%
          </small>
        </>
      )}
    </div>
  )
}

export default function OptionsPanel({
  dataset,
  preferences,
  onMetadataRegionChange,
  onGameLocaleChange,
  onPoolPresentationChange,
  onBulkAppearanceChange,
}: {
  dataset: OperatorDataset | null
  preferences: OperatorPreferences
  onMetadataRegionChange: (region: ReleaseServer) => void
  onGameLocaleChange: (locale: GameLocale) => void
  onPoolPresentationChange: (mode: PoolPresentationMode) => void
  onBulkAppearanceChange: (choice: 'e1' | 'e2' | 'random' | 'account') => void
}): React.JSX.Element {
  const confirmDraftActions = useDraftActionConfirmationPreference()
  const [bulkAppearanceChoice, setBulkAppearanceChoice] = useState<
    'e1' | 'e2' | 'random' | 'account'
  >('e2')

  return (
    <section className="panel options-panel" aria-label="Options">
      <ArknightsAccountPanel dataset={dataset} />

      <div className="primary-settings">
        <label className="field">
          <span>Metadata region</span>
          <select
            value={preferences.metadataRegion}
            onChange={(event) => onMetadataRegionChange(event.target.value as ReleaseServer)}
          >
            <option value="global">EN / Global</option>
            <option value="cn">CN</option>
          </select>
          <small>
            Controls operator and Garrison event availability, event release order, release-year grouping, Kernel-era
            classification, and release previews.
          </small>
        </label>

        <label className="field">
          <span>App Localization</span>
          <select
            value={preferences.gameLocale}
            onChange={(event) => onGameLocaleChange(event.target.value as GameLocale)}
          >
            {gameLocales.map((locale) => (
              <option key={locale} value={locale}>
                {GAME_LOCALE_LABELS[locale]}
              </option>
            ))}
          </select>
          <small>
            Controls localized names (including Garrison events) and game terminology. App interface text remains English.
          </small>
        </label>

        <label className="field">
          <span>Pool presentation</span>
          <select
            value={preferences.poolPresentation}
            onChange={(event) =>
              onPoolPresentationChange(event.target.value as PoolPresentationMode)
            }
          >
            {(Object.entries(presentationLabels) as Array<[PoolPresentationMode, string]>).map(
              ([mode, label]) => (
                <option key={mode} value={mode}>
                  {label}
                </option>
              ),
            )}
          </select>
          <small>
            Presentation only. This never changes eligibility, grouping, search, or inclusion state.
          </small>
        </label>
      </div>

      <div className="option-setting option-setting--compact">
        <div className="option-setting__copy">
          <strong>Draft action confirmations</strong>
          <p>
            Ask before Pick, Hold, Forfeit, Reroll, Release, Expand, and New Draft. Session-level
            suppression remains available inside each confirmation.
          </p>
        </div>
        <label className="option-toggle">
          <input
            type="checkbox"
            checked={confirmDraftActions}
            onChange={(event) => setDraftActionConfirmationPreference(event.target.checked)}
          />
          <span>Confirm Draft actions</span>
        </label>
      </div>

      <div className="option-setting">
        <div className="option-setting__copy">
          <strong>Bulk operator appearance</strong>
          <p>
            Apply one appearance choice to every currently loaded operator. Individual operators can
            then be changed from Setup → Global Pool → Curate. This is presentation-only.
          </p>
        </div>
        <div className="bulk-appearance-control">
          <label className="field">
            <span>Appearance</span>
            <select
              value={bulkAppearanceChoice}
              onChange={(event) =>
                setBulkAppearanceChoice(event.target.value as 'e1' | 'e2' | 'random' | 'account')
              }
            >
              <option value="e1">Elite 1 for all</option>
              <option value="e2">Elite 2 for all</option>
              <option value="random">Randomize all</option>
              <option value="account">Sync account outfits</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onBulkAppearanceChange(bulkAppearanceChoice)}
          >
            Apply
          </button>
        </div>
      </div>

      <p className="option-note">
        Bulk changes do not affect Pool inclusion. Later per-operator appearance changes override
        the bulk result without changing other operators.
      </p>

      <ArtworkDownloadStatus />
    </section>
  )
}
