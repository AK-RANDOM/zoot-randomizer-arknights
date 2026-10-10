import { useState } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import DraftRulebookGeneralRulesEditor from './DraftRulebookGeneralRulesEditor'
import DraftRulebookIdentifierEditor from './DraftRulebookIdentifierEditor'
import DraftRulebookInteractionsEditor from './DraftRulebookInteractionsEditor'
import DraftRulebookLibrary from './DraftRulebookLibrary'
import DraftRulebookOverridesEditor, {
  draftRulebookOverrideCount,
} from './DraftRulebookOverridesEditor'
import DraftRulebookPoolEditor from './DraftRulebookPoolEditor'
import DraftPricingProfileEditor from './DraftPricingProfileEditor'
import useDraftRulebookLibrary from './useDraftRulebookLibrary'
import useDraftPricingProfiles from './useDraftPricingProfiles'
import './DraftRulebookPanel.css'

interface DraftRulebookPanelProps {
  dataset: OperatorDataset
}

export const DRAFT_RULEBOOK_EDITOR_SECTIONS = [
  { id: 'identifier', label: 'Identifier' },
  { id: 'general', label: 'General Rules' },
  { id: 'pool', label: 'Pool' },
  { id: 'overrides', label: 'Overrides' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'pricing', label: 'Pricing' },
] as const

export type DraftRulebookEditorSection = (typeof DRAFT_RULEBOOK_EDITOR_SECTIONS)[number]['id']

export default function DraftRulebookPanel({
  dataset,
}: DraftRulebookPanelProps): React.JSX.Element {
  const library = useDraftRulebookLibrary(dataset)
  const pricing = useDraftPricingProfiles()
  const selected = library.selected
  const [activeSection, setActiveSection] = useState<DraftRulebookEditorSection>('identifier')

  const editor = (() => {
    switch (activeSection) {
      case 'identifier':
        return (
          <DraftRulebookIdentifierEditor
            rulebook={selected}
            disabled={library.builtIn}
            lastEditedAt={library.selectedEntry.editor.lastEditedAt}
            onChange={library.updateSelected}
          />
        )
      case 'general':
        return (
          <DraftRulebookGeneralRulesEditor
            rulebook={selected}
            dataset={dataset}
            disabled={library.builtIn}
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
      case 'overrides':
        return (
          <DraftRulebookOverridesEditor
            rulebook={selected}
            dataset={dataset}
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
      case 'pricing':
        return (
          <DraftPricingProfileEditor
            dataset={dataset}
            controller={pricing}
            rulebook={selected}
            rulebookBuiltIn={library.builtIn}
            onRulebookChange={library.updateSelected}
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
