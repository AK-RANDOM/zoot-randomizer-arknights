import { useState } from 'react'
import type { OperatorPreferences } from '../../shared/operatorPool'
import {
  gameLocales,
  type GameLocale,
  type OperatorDataset,
  type ReleaseServer,
} from '../../shared/operator'
import ArknightsAccountPanel from './ArknightsAccountPanel'
import { browserAccountAvailable } from './browserAccount'
import { GAME_LOCALE_LABELS } from '../../shared/gameLocalization'
import {
  setDraftActionConfirmationPreference,
  useDraftActionConfirmationPreference,
} from './draftConfirmationPreferences'

export default function OptionsPanel({
  dataset,
  preferences,
  onMetadataRegionChange,
  onGameLocaleChange,
  onCurateNamesChange,
  onBulkAppearanceChange,
}: {
  dataset: OperatorDataset | null
  preferences: OperatorPreferences
  onMetadataRegionChange: (region: ReleaseServer) => void
  onGameLocaleChange: (locale: GameLocale) => void
  onCurateNamesChange: (enabled: boolean) => void
  onBulkAppearanceChange: (choice: 'e1' | 'e2' | 'random' | 'account') => void
}): React.JSX.Element {
  const confirmDraftActions = useDraftActionConfirmationPreference()
  const [bulkAppearanceChoice, setBulkAppearanceChoice] = useState<
    'e1' | 'e2' | 'random' | 'account'
  >('e2')

  const accountAvailable = window.desktop.platform !== 'browser' || browserAccountAvailable

  return (
    <section className="panel options-panel" aria-label="Options">
      {accountAvailable && <ArknightsAccountPanel dataset={dataset} />}

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
            Controls operator and Garrison event availability, event release order, release-year
            grouping, Kernel pool membership, and release previews.
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
            Controls localized names (including Garrison events) and game terminology. App interface
            text remains English.
          </small>
        </label>
      </div>

      <div className="option-setting option-setting--compact">
        <div className="option-setting__copy">
          <strong id="curate-names-heading">Show operator names in Curate</strong>
          <p>Display operator names on tiles in Setup → Global Pool → Curate.</p>
        </div>
        <label className="option-toggle">
          <input
            type="checkbox"
            aria-labelledby="curate-names-heading"
            checked={preferences.showCurateNames ?? false}
            onChange={(event) => onCurateNamesChange(event.target.checked)}
          />
          <span>Show names</span>
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
              {accountAvailable && <option value="account">Sync account outfits</option>}
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
    </section>
  )
}
