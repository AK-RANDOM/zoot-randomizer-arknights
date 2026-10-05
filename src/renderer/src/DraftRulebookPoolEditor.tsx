import type { OperatorDataset } from '../../shared/operator'
import {
  createEmptyDraftRulebookEligibility,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { DraftRulebookEligibilityEditor } from './DraftRulebookSelectorEditor'

export default function DraftRulebookPoolEditor({
  rulebook,
  dataset,
  disabled,
  onChange,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset
  disabled: boolean
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  const setPoolSource = (source: DraftRulebook['pool']['source']): void => onChange((draft) => {
    if (source === 'inherit-global') {
      draft.pool = { source }
      return
    }
    const eligibility = draft.pool.source === 'inherit-global'
      ? createEmptyDraftRulebookEligibility()
      : draft.pool.eligibility
    draft.pool = { source, eligibility }
  })

  return (
    <fieldset className="constraint-group rulebook-editor-section">
      <legend>Pool</legend>
      <label className="field">
        <span>Pool Source</span>
        <select disabled={disabled} value={rulebook.pool.source} onChange={(event) => setPoolSource(event.target.value as DraftRulebook['pool']['source'])}>
          <option value="inherit-global">Inherit Global Pool</option>
          <option value="global-restrictions">Global Pool + Rulebook Restrictions</option>
          <option value="rulebook-pool">Rulebook Pool</option>
        </select>
      </label>
      <p className="filter-note">
        {rulebook.pool.source === 'inherit-global'
          ? 'Uses the current app-wide Global Pool exactly.'
          : rulebook.pool.source === 'global-restrictions'
            ? 'Restrictions can only remove operators from the current Global Pool.'
            : 'Eligibility resolves from the installed dataset and ignores Global Pool exclusions.'}
      </p>
      {rulebook.pool.source !== 'inherit-global' && (
        <DraftRulebookEligibilityEditor
          dataset={dataset}
          eligibility={rulebook.pool.eligibility}
          disabled={disabled}
          onChange={(eligibility) => onChange((draft) => {
            if (draft.pool.source !== 'inherit-global') draft.pool.eligibility = eligibility
          })}
        />
      )}
    </fieldset>
  )
}
