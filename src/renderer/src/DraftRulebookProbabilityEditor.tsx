import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftRulebookDistributionEditor from './DraftRulebookDistributionEditor'

export default function DraftRulebookProbabilityEditor({
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
  const distribution = rulebook.generalRules.pullDistribution ?? { type: 'equal' as const }

  return (
    <>
      <fieldset className="constraint-group rulebook-editor-section">
        <legend>Probability</legend>
        <p className="filter-note">
          This screen uses the current pull-distribution backend. It is intentionally separated now
          so it can later map to the Rulebook probability component without changing the editor
          navigation.
        </p>
        <DraftRulebookDistributionEditor
          dataset={dataset}
          distribution={distribution}
          disabled={disabled}
          onChange={(nextDistribution) =>
            onChange((draft) => {
              draft.generalRules.pullDistribution = nextDistribution
            })
          }
        />
      </fieldset>
    </>
  )
}
