import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftPricingProfileEditor from './DraftPricingProfileEditor'
import DraftRulebookOverridesEditor from './DraftRulebookOverridesEditor'
import type { DraftPricingProfileController } from './useDraftPricingProfiles'

export default function DraftRulebookPricingEditor({
  rulebook,
  dataset,
  disabled,
  controller,
  onChange,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset
  disabled: boolean
  controller: DraftPricingProfileController
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  return (
    <>
      <fieldset className="constraint-group rulebook-editor-section">
        <legend>Pricing</legend>
        <p className="filter-note">
          Operator base-cost overrides and CSV pricing profiles are grouped here as one pricing
          surface. They still write to the current backend until the final prices.csv model lands.
        </p>
      </fieldset>
      <DraftRulebookOverridesEditor
        rulebook={rulebook}
        dataset={dataset}
        disabled={disabled}
        onChange={onChange}
      />
      <DraftPricingProfileEditor
        dataset={dataset}
        controller={controller}
        rulebook={rulebook}
        rulebookBuiltIn={disabled}
        onRulebookChange={onChange}
      />
    </>
  )
}
