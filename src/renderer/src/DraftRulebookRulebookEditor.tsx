import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftRulebookGeneralRulesEditor from './DraftRulebookGeneralRulesEditor'
import DraftRulebookIdentifierEditor from './DraftRulebookIdentifierEditor'
import './DraftRulebookCompatibility.css'

export default function DraftRulebookRulebookEditor({
  rulebook,
  dataset,
  disabled,
  lastEditedAt,
  onChange,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset
  disabled: boolean
  lastEditedAt: string | null
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  return (
    <>
      <DraftRulebookIdentifierEditor
        rulebook={rulebook}
        disabled={disabled}
        lastEditedAt={lastEditedAt}
        onChange={onChange}
      />
      <div className="rulebook-rulebook-compat">
        <DraftRulebookGeneralRulesEditor
          rulebook={rulebook}
          dataset={dataset}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </>
  )
}
