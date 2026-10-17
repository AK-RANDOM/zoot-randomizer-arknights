import { useEffect, useState } from 'react'
import type { PortraitSyncProgress } from '../../shared/desktop'
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

function ArtworkChoice({
  value,
  selected,
  title,
  description,
  onChoose,
}: {
  value: 'e1' | 'e2' | 'random' | 'account'
  selected: boolean
  title: string
  description: string
  onChoose: (value: 'e1' | 'e2' | 'random' | 'account') => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`artwork-choice${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onChoose(value)}
    >
      <span className="artwork-choice__mark" aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  )
}

function ArtworkDownloadStatus(): React.JSX.Element {
  const [progress, setProgress] = useState<PortraitSyncProgress | null>(null)

  useEffect(() => {
    let active = true
    void window.desktop.getPortraitSyncProgress().then((next) => {
      if (active) setProgress(next)
    })
    const unsubscribe = window.desktop.onPortraitSyncProgress((next) => {
      if (active) setProgress(next)
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
            onClick={() => void window.desktop.startPortraitSync().then(setProgress)}
          >
            Retry
          </button>
        )}
      </div>
      {downloading && (
        <>
          <progress value={progress.completed} max={Math.max(progress.total, 1)} />
          <small>
            {progress.completed} / {progress.total} operators · {percent}%
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
  onShowAccountProgressionChange,
}: {
  dataset: OperatorDataset | null
  preferences: OperatorPreferences
  onMetadataRegionChange: (region: ReleaseServer) => void
  onGameLocaleChange: (locale: GameLocale) => void
  onPoolPresentationChange: (mode: PoolPresentationMode) => void
  onBulkAppearanceChange: (choice: 'e1' | 'e2' | 'random' | 'account') => void
  onShowAccountProgressionChange: (enabled: boolean) => void
}): React.JSX.Element {
  const confirmDraftActions = useDraftActionConfirmationPreference()
  const [activeSection, setActiveSection] = useState<'preferences' | 'account'>('preferences')

  return (
    <section className="panel options-panel" aria-labelledby="options-heading">
      <div className="section-heading options-heading">
        <div>
          <p className="eyebrow">OPTIONS</p>
          <h2 id="options-heading">App preferences</h2>
        </div>
      </div>

      <nav className="squad-mode-tabs" aria-label="Options section">
        {(
          [
            ['preferences', 'Preferences'],
            ['account', 'Account'],
          ] as const
        ).map(([section, label]) => (
          <button
            key={section}
            type="button"
            className={activeSection === section ? 'is-active' : ''}
            aria-selected={activeSection === section}
            onClick={() => setActiveSection(section)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeSection === 'preferences' && (
        <>
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
                Controls operator availability, release dates, release-year grouping, Kernel-era
                classification, and release previews.
              </small>
            </label>

            <label className="field">
              <span>Game localization</span>
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
                Changes game-provided names and terminology only. App interface text remains
                English.
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
                Presentation only. This never changes eligibility, grouping, search, or inclusion
                state.
              </small>
            </label>
          </div>

          <div className="option-setting option-setting--compact">
            <div className="option-setting__copy">
              <strong>Draft action confirmations</strong>
              <p>
                Ask before Pick, Hold, Forfeit, Reroll, Release, Expand, and New Draft.
                Session-level suppression remains available inside each confirmation.
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
                Apply one appearance choice to every currently loaded operator. Individual operators
                can then be changed from Setup → Global Pool → Curate. This is presentation-only.
              </p>
            </div>
            <div className="artwork-choice-group" aria-label="Bulk operator appearance">
              <ArtworkChoice
                value="e1"
                selected={false}
                title="Use E1 for all"
                description="Apply base promotion portraits"
                onChoose={onBulkAppearanceChange}
              />
              <ArtworkChoice
                value="e2"
                selected={false}
                title="Use E2 for all"
                description="Apply E2 portraits with E1 fallback"
                onChoose={onBulkAppearanceChange}
              />
              <ArtworkChoice
                value="random"
                selected={false}
                title="Randomize all"
                description="Choose a stable random E1, E2, or skin for each operator"
                onChoose={onBulkAppearanceChange}
              />
              <ArtworkChoice
                value="account"
                selected={false}
                title="Sync account outfits"
                description="Follow each imported operator's currently equipped outfit"
                onChoose={onBulkAppearanceChange}
              />
            </div>
          </div>

          <p className="option-note">
            Bulk changes do not affect Pool inclusion. Later per-operator appearance changes
            override the bulk result without changing other operators.
          </p>

          <ArtworkDownloadStatus />
        </>
      )}

      {activeSection === 'account' && (
        <>
          <fieldset className="constraint-group detail-group">
            <legend>Account display</legend>
            <label className="source-check">
              <input
                type="checkbox"
                checked={preferences.showAccountProgression}
                onChange={(event) => onShowAccountProgressionChange(event.target.checked)}
              />
              <span>Show synced operator progression on operator cards</span>
            </label>
            <p className="filter-note">
              Shows synced elite and level above the rarity stars, for example E0 L60.
            </p>
          </fieldset>
          <ArknightsAccountPanel dataset={dataset} />
        </>
      )}
    </section>
  )
}
