import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftRulebookInteractionEditor from './DraftRulebookInteractionEditor'

export default function DraftRulebookInteractionsEditor({
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
  return (
    <fieldset className="constraint-group rulebook-editor-section rulebook-wide-section">
      <legend>Interactions</legend>
      <DraftRulebookInteractionEditor
        rulebook={rulebook}
        dataset={dataset}
        disabled={disabled}
        onChange={(interactions) => onChange((draft) => { draft.interactions = interactions })}
      />
    </fieldset>
  )
}
