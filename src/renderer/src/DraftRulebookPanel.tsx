import type { OperatorDataset } from '../../shared/operator'
import DraftRulebookGeneralRulesEditor from './DraftRulebookGeneralRulesEditor'
import DraftRulebookIdentifierEditor from './DraftRulebookIdentifierEditor'
import DraftRulebookInteractionsEditor from './DraftRulebookInteractionsEditor'
import DraftRulebookLibrary from './DraftRulebookLibrary'
import DraftRulebookOverridesEditor, { draftRulebookOverrideCount } from './DraftRulebookOverridesEditor'
import DraftRulebookPoolEditor from './DraftRulebookPoolEditor'
import useDraftRulebookLibrary from './useDraftRulebookLibrary'
import './DraftRulebookPanel.css'

interface DraftRulebookPanelProps {
  dataset: OperatorDataset
}

export default function DraftRulebookPanel({ dataset }: DraftRulebookPanelProps): React.JSX.Element {
  const library = useDraftRulebookLibrary(dataset)
  const selected = library.selected

  return (
    <section className="panel rulebook-panel" aria-labelledby="rulebook-heading">
      <DraftRulebookLibrary
        library={library}
        overrideCount={draftRulebookOverrideCount(selected)}
      />

      <div className="rulebook-editor-grid" key={selected.identifier.id}>
        <DraftRulebookIdentifierEditor
          rulebook={selected}
          disabled={library.builtIn}
          onChange={library.updateSelected}
        />
        <DraftRulebookGeneralRulesEditor
          rulebook={selected}
          dataset={dataset}
          disabled={library.builtIn}
          onChange={library.updateSelected}
        />
        <DraftRulebookPoolEditor
          rulebook={selected}
          dataset={dataset}
          disabled={library.builtIn}
          onChange={library.updateSelected}
        />
      </div>

      <DraftRulebookOverridesEditor
        key={`${selected.identifier.id}:overrides`}
        rulebook={selected}
        dataset={dataset}
        disabled={library.builtIn}
        onChange={library.updateSelected}
      />

      <DraftRulebookInteractionsEditor
        rulebook={selected}
        dataset={dataset}
        disabled={library.builtIn}
        onChange={library.updateSelected}
      />
    </section>
  )
}
