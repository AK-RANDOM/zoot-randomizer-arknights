import {
  operatorClasses,
  operatorRarities,
  type OperatorClass,
  type OperatorDataset,
  type OperatorRarity,
} from '../../shared/operator'
import type {
  DraftRulebookEligibility,
  DraftRulebookSelector,
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

function sortedEntries(labels: Readonly<Record<string, string>>): Array<[string, string]> {
  return Object.entries(labels).sort((left, right) => left[1].localeCompare(right[1]))
}

function subclassOptions(dataset: OperatorDataset): Array<[string, string]> {
  return [...new Map(dataset.operators.map((operator) => [operator.subclass.id, operator.subclass.name])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
}

function raceOptions(dataset: OperatorDataset): Array<[string, string]> {
  const ids = new Set(dataset.operators.flatMap((operator) => operator.raceIds ?? []))
  return [...ids]
    .map((id) => [id, dataset.raceLabels?.[id] ?? id] as [string, string])
    .sort((left, right) => left[1].localeCompare(right[1]))
}

export function createDefaultDraftRulebookSelector(
  type: DraftRulebookSelector['type'],
  dataset: OperatorDataset,
): DraftRulebookSelector {
  switch (type) {
    case 'operators':
      return { type, operatorIds: dataset.operators[0] ? [dataset.operators[0].id] : ['missing:operator'] }
    case 'rarities':
      return { type, rarities: [6] }
    case 'classes':
      return { type, classes: ['Guard'] }
    case 'subclasses':
      return { type, subclassIds: [subclassOptions(dataset)[0]?.[0] ?? 'missing:subclass'] }
    case 'factions':
      return { type, factionIds: [sortedEntries(dataset.factionLabels)[0]?.[0] ?? 'missing:faction'] }
    case 'races':
      return { type, raceIds: [raceOptions(dataset)[0]?.[0] ?? 'missing:race'] }
  }
}

export function DraftRulebookSelectorEditor({
  dataset,
  selector,
  disabled = false,
  onChange,
  onRemove,
}: DraftRulebookSelectorEditorProps): React.JSX.Element {
  const operators = [...dataset.operators].sort((left, right) => left.name.localeCompare(right.name))
  const subclasses = subclassOptions(dataset)
  const factions = sortedEntries(dataset.factionLabels)
  const races = raceOptions(dataset)

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
          <option value="operators">Operators</option>
          <option value="rarities">Rarities</option>
          <option value="classes">Classes</option>
          <option value="subclasses">Subclasses</option>
          <option value="factions">Factions</option>
          <option value="races">Races</option>
        </select>
      </label>

      {selector.type === 'operators' && (
        <label className="field rulebook-selector-values">
          <span>Matching operators</span>
          <select
            multiple
            size={Math.min(8, Math.max(3, operators.length))}
            disabled={disabled}
            value={selector.operatorIds}
            onChange={(event) => onChange({ type: 'operators', operatorIds: selectedValues(event) })}
          >
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>{operator.name} ({operator.rarity}★)</option>
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
            {operatorRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}★</option>)}
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
            {operatorClasses.map((operatorClass) => (
              <option key={operatorClass} value={operatorClass}>{dataset.classLabels?.[operatorClass] ?? operatorClass}</option>
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
            {subclasses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
            {factions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
            {races.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
