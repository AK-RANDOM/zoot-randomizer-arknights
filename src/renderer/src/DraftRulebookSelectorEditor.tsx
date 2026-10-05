import type {
  OperatorClass,
  OperatorDataset,
  OperatorRarity,
} from '../../shared/operator'
import {
  DRAFT_RULEBOOK_SELECTOR_TYPE_OPTIONS,
  createDefaultDraftRulebookSelector,
  createDraftRulebookSelectorCatalog,
  type DraftRulebookEligibility,
  type DraftRulebookSelector,
} from '../../shared/draftRulebook'

export type DraftRulebookEligibilitySection = 'allOf' | 'anyOf' | 'noneOf'

interface DraftRulebookSelectorEditorProps {
  dataset: OperatorDataset
  selector: DraftRulebookSelector
  disabled?: boolean
  onChange: (selector: DraftRulebookSelector) => void
  onRemove?: () => void
}

function selectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions, (option) => option.value)
}

export function DraftRulebookSelectorEditor({
  dataset,
  selector,
  disabled = false,
  onChange,
  onRemove,
}: DraftRulebookSelectorEditorProps): React.JSX.Element {
  const catalog = createDraftRulebookSelectorCatalog(dataset)

  return (
    <div className="rulebook-selector-editor">
      <label className="field">
        <span>Selector</span>
        <select
          disabled={disabled}
          value={selector.type}
          onChange={(event) => onChange(createDefaultDraftRulebookSelector(
            event.target.value as DraftRulebookSelector['type'],
            dataset,
          ))}
        >
          {DRAFT_RULEBOOK_SELECTOR_TYPE_OPTIONS.map((option) => (
            <option key={option.type} value={option.type}>{option.label}</option>
          ))}
        </select>
      </label>

      {selector.type === 'operators' && (
        <label className="field rulebook-selector-values">
          <span>Matching operators</span>
          <select
            multiple
            size={Math.min(8, Math.max(3, catalog.operators.length))}
            disabled={disabled}
            value={selector.operatorIds}
            onChange={(event) => onChange({ type: 'operators', operatorIds: selectedValues(event) })}
          >
            {catalog.operators.map((operator) => (
              <option key={operator.id} value={operator.id}>{operator.label} ({operator.rarity}★)</option>
            ))}
          </select>
        </label>
      )}

      {selector.type === 'rarities' && (
        <label className="field rulebook-selector-values">
          <span>Matching rarities</span>
          <select
            multiple
            size={6}
            disabled={disabled}
            value={selector.rarities.map(String)}
            onChange={(event) => onChange({
              type: 'rarities',
              rarities: selectedValues(event).map(Number) as OperatorRarity[],
            })}
          >
            {catalog.rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}★</option>)}
          </select>
        </label>
      )}

      {selector.type === 'classes' && (
        <label className="field rulebook-selector-values">
          <span>Matching classes</span>
          <select
            multiple
            size={8}
            disabled={disabled}
            value={selector.classes}
            onChange={(event) => onChange({
              type: 'classes',
              classes: selectedValues(event) as OperatorClass[],
            })}
          >
            {catalog.classes.map((operatorClass) => (
              <option key={operatorClass.id} value={operatorClass.id}>{operatorClass.label}</option>
            ))}
          </select>
        </label>
      )}

      {selector.type === 'subclasses' && (
        <label className="field rulebook-selector-values">
          <span>Matching subclasses</span>
          <select
            multiple
            size={8}
            disabled={disabled}
            value={selector.subclassIds}
            onChange={(event) => onChange({ type: 'subclasses', subclassIds: selectedValues(event) })}
          >
            {catalog.subclasses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      )}

      {selector.type === 'factions' && (
        <label className="field rulebook-selector-values">
          <span>Matching factions</span>
          <select
            multiple
            size={8}
            disabled={disabled}
            value={selector.factionIds}
            onChange={(event) => onChange({ type: 'factions', factionIds: selectedValues(event) })}
          >
            {catalog.factions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      )}

      {selector.type === 'races' && (
        <label className="field rulebook-selector-values">
          <span>Matching races</span>
          <select
            multiple
            size={8}
            disabled={disabled}
            value={selector.raceIds}
            onChange={(event) => onChange({ type: 'races', raceIds: selectedValues(event) })}
          >
            {catalog.races.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      )}

      {onRemove && (
        <button type="button" className="secondary-button" disabled={disabled} onClick={onRemove}>Remove selector</button>
      )}
    </div>
  )
}

export function DraftRulebookEligibilityEditor({
  dataset,
  eligibility,
  disabled = false,
  onChange,
}: {
  dataset: OperatorDataset
  eligibility: DraftRulebookEligibility
  disabled?: boolean
  onChange: (eligibility: DraftRulebookEligibility) => void
}): React.JSX.Element {
  const updateSelector = (
    section: DraftRulebookEligibilitySection,
    index: number,
    selector: DraftRulebookSelector,
  ): void => {
    onChange({
      ...eligibility,
      [section]: eligibility[section].map((current, currentIndex) => currentIndex === index ? selector : current),
    })
  }

  const removeSelector = (section: DraftRulebookEligibilitySection, index: number): void => {
    onChange({
      ...eligibility,
      [section]: eligibility[section].filter((_, currentIndex) => currentIndex !== index),
    })
  }

  const addSelector = (section: DraftRulebookEligibilitySection): void => {
    onChange({
      ...eligibility,
      [section]: [...eligibility[section], createDefaultDraftRulebookSelector('operators', dataset)],
    })
  }

  const sections: Array<[DraftRulebookEligibilitySection, string, string]> = [
    ['allOf', 'All of', 'Every selector must match.'],
    ['anyOf', 'Any of', 'At least one selector must match when this section is non-empty.'],
    ['noneOf', 'None of', 'Matching operators are excluded.'],
  ]

  return (
    <div className="rulebook-eligibility-editor">
      {sections.map(([section, label, help]) => (
        <section className="rulebook-eligibility-section" key={section}>
          <div className="rulebook-editor-subheading">
            <div><strong>{label}</strong><small>{help}</small></div>
            <button type="button" className="secondary-button" disabled={disabled} onClick={() => addSelector(section)}>Add selector</button>
          </div>
          {eligibility[section].length === 0 ? (
            <p className="filter-note">No selectors.</p>
          ) : eligibility[section].map((selector, index) => (
            <DraftRulebookSelectorEditor
              key={`${section}:${index}`}
              dataset={dataset}
              selector={selector}
              disabled={disabled}
              onChange={(next) => updateSelector(section, index, next)}
              onRemove={() => removeSelector(section, index)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
