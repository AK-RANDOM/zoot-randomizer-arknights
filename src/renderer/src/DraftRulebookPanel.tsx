import { useState } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import DraftRulebookInteractionsEditor from './DraftRulebookInteractionsEditor'
import DraftRulebookLibrary from './DraftRulebookLibrary'
import DraftRulebookRulebookEditor from './DraftRulebookRulebookEditor'
import DraftRulebookVariablesEditor from './DraftRulebookVariablesEditor'
import DraftRulebookProbabilityEditor from './DraftRulebookProbabilityEditor'
import DraftRulebookPricingEditor from './DraftRulebookPricingEditor'
import { draftRulebookOverrideCount } from './DraftRulebookOverridesEditor'
import DraftRulebookPoolEditor from './DraftRulebookPoolEditor'
import useDraftRulebookLibrary from './useDraftRulebookLibrary'
import useDraftPricingProfiles from './useDraftPricingProfiles'
import './DraftRulebookPanel.css'

interface DraftRulebookPanelProps {
  dataset: OperatorDataset
}

export const DRAFT_RULEBOOK_EDITOR_SECTIONS = [
  { id: 'rulebook', label: 'Rulebook' },
  { id: 'pool', label: 'Pool' },
  { id: 'variables', label: 'Variables' },
  { id: 'probability', label: 'Probability' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'interactions', label: 'Interactions' },
] as const

export type DraftRulebookEditorSection = (typeof DRAFT_RULEBOOK_EDITOR_SECTIONS)[number]['id']

export default function DraftRulebookPanel({
  dataset,
}: DraftRulebookPanelProps): React.JSX.Element {
  const library = useDraftRulebookLibrary(dataset)
  const pricing = useDraftPricingProfiles()
  const selected = library.selected
  const [activeSection, setActiveSection] = useState<DraftRulebookEditorSection>('rulebook')

  const editor = (() => {
    switch (activeSection) {
      case 'rulebook':
        return (
          <DraftRulebookRulebookEditor
            rulebook={selected}
            dataset={dataset}
            disabled={library.builtIn}
            lastEditedAt={library.selectedEntry.editor.lastEditedAt}
            onChange={library.updateSelected}
          />
        )
      case 'pool':
        return (
          <DraftRulebookPoolEditor
            rulebook={selected}
            dataset={dataset}
            disabled={library.builtIn}
            onChange={library.updateSelected}
          />
        )
      case 'variables':
        return <DraftRulebookVariablesEditor />
      case 'probability':
        return (
          <DraftRulebookProbabilityEditor
            rulebook={selected}
            dataset={dataset}
            disabled={library.builtIn}
            onChange={library.updateSelected}
          />
        )
      case 'pricing':
        return (
          <DraftRulebookPricingEditor
            dataset={dataset}
            controller={pricing}
            rulebook={selected}
            disabled={library.builtIn}
            onChange={library.updateSelected}
          />
        )
      case 'interactions':
        return (
          <DraftRulebookInteractionsEditor
            rulebook={selected}
            dataset={dataset}
            disabled={library.builtIn}
            onChange={library.updateSelected}
          />
        )
    }
  })()

  return (
    <section className="panel rulebook-panel" aria-labelledby="rulebook-heading">
      <DraftRulebookLibrary
        library={library}
        overrideCount={draftRulebookOverrideCount(selected)}
      />

      <nav
        className="rulebook-section-tabs"
        role="tablist"
        aria-label="Draft Rulebook editor sections"
      >
        {DRAFT_RULEBOOK_EDITOR_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`rulebook-tab-${section.id}`}
            aria-selected={activeSection === section.id}
            aria-controls={`rulebook-section-${section.id}`}
            className={activeSection === section.id ? 'is-active' : ''}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div
        key={`${selected.identifier.id}:${activeSection}`}
        id={`rulebook-section-${activeSection}`}
        className="rulebook-section-content"
        role="tabpanel"
        aria-labelledby={`rulebook-tab-${activeSection}`}
      >
        {editor}
      </div>
    </section>
  )
}
