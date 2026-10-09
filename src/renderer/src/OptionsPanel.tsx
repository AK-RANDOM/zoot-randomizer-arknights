import { useEffect, useState } from 'react'
import type { PortraitSyncProgress } from '../../shared/desktop'
import type { OperatorPreferences, PoolPresentationMode } from '../../shared/operatorPool'
import { gameLocales, type GameLocale, type ReleaseServer } from '../../shared/operator'
import { GAME_LOCALE_LABELS } from '../../shared/gameLocalization'
import type { PromotionArt } from '../../shared/portraits'
import {
  setOperatorArtworkPreference,
  useOperatorArtworkPreference,
} from './presentationPreferences'
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
}: {
  value: PromotionArt
  selected: boolean
  title: string
  description: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`artwork-choice${selected ? ' is-selected' : ''}`}
      role="radio"
      aria-checked={selected}
      onClick={() => setOperatorArtworkPreference(value)}
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
  preferences,
  onMetadataRegionChange,
  onGameLocaleChange,
  onPoolPresentationChange,
}: {
  preferences: OperatorPreferences
  onMetadataRegionChange: (region: ReleaseServer) => void
  onGameLocaleChange: (locale: GameLocale) => void
  onPoolPresentationChange: (mode: PoolPresentationMode) => void
}): React.JSX.Element {
  const artworkPreference = useOperatorArtworkPreference()
  const confirmDraftActions = useDraftActionConfirmationPreference()

  return (
    <section className="panel options-panel" aria-labelledby="options-heading">
      <div className="section-heading options-heading">
        <div>
          <p className="eyebrow">OPTIONS</p>
          <h2 id="options-heading">App preferences</h2>
        </div>
      </div>

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
            Changes game-provided names and terminology only. App interface text remains English.
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
          <strong>Operator artwork</strong>
          <p>
            Choose the promotion artwork used on generated squad cards. This is a display-only
            preference and never changes operator eligibility, constraints, or the current squad.
          </p>
        </div>
        <div className="artwork-choice-group" role="radiogroup" aria-label="Operator artwork">
          <ArtworkChoice
            value="e1"
            selected={artworkPreference === 'e1'}
            title="E1"
            description="Base promotion portrait"
          />
          <ArtworkChoice
            value="e2"
            selected={artworkPreference === 'e2'}
            title="E2"
            description="E2 portrait where available; otherwise E1"
          />
        </div>
      </div>

      <p className="option-note">
        Amiya alternate forms use their available E2-style form portrait for both choices when the
        resource set does not provide a separate E1 portrait.
      </p>

      <ArtworkDownloadStatus />
    </section>
  )
}
