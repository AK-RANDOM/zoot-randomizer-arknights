import { useMemo, useState } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import { getDraftRulebookOperatorCostBreakdown } from '../../shared/draftRulebookCost'
import OperatorCard from './OperatorCard'
import { buildRulebookOperatorInteractionDetails } from './draftInteractionPresentation'
import { signed } from './draftRulebookEditorUtils'

export default function DraftRulebookOverridesEditor({
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
  const [operatorId, setOperatorId] = useState('')
  const [overrideCost, setOverrideCost] = useState('')
  const sortedOperators = useMemo(
    () => [...dataset.operators].sort((left, right) => left.name.localeCompare(right.name)),
    [dataset.operators],
  )
  const operatorById = useMemo(
    () => new Map(dataset.operators.map((operator) => [operator.id, operator] as const)),
    [dataset.operators],
  )
  const overrideIds = useMemo(
    () => Object.keys(rulebook.overrides.operatorCosts).sort((left, right) =>
      (operatorById.get(left)?.name ?? left).localeCompare(operatorById.get(right)?.name ?? right)),
    [operatorById, rulebook.overrides.operatorCosts],
  )

  const chooseOperator = (nextId: string): void => {
    setOperatorId(nextId)
    if (!nextId) {
      setOverrideCost('')
      return
    }
    const operator = operatorById.get(nextId)
    if (!operator) return
    setOverrideCost(String(
      rulebook.overrides.operatorCosts[nextId] ??
      getDraftRulebookOperatorCostBreakdown(rulebook, operator).rarityCost,
    ))
  }

  const saveOverride = (): void => {
    const operator = operatorById.get(operatorId)
    const value = Number(overrideCost)
    if (!operator || disabled || !Number.isFinite(value)) return
    onChange((draft) => { draft.overrides.operatorCosts[operator.id] = value })
  }

  const removeOverride = (id: string): void => onChange((draft) => {
    delete draft.overrides.operatorCosts[id]
  })

  return (
    <fieldset className="constraint-group rulebook-editor-section rulebook-overrides-section">
      <legend>Overrides</legend>
      <div className="rulebook-override-adder">
        <label className="field">
          <span>Operator</span>
          <select disabled={disabled} value={operatorId} onChange={(event) => chooseOperator(event.target.value)}>
            <option value="">Choose operator…</option>
            {sortedOperators.map((operator) => (
              <option key={operator.id} value={operator.id}>{operator.name} ({operator.rarity}★)</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Baseline cost</span>
          <input type="number" disabled={disabled || !operatorId} value={overrideCost} onChange={(event) => setOverrideCost(event.target.value)} />
        </label>
        <button type="button" className="secondary-button" disabled={disabled || !operatorId || !Number.isFinite(Number(overrideCost))} onClick={saveOverride}>Add / Update</button>
      </div>

      {overrideIds.length === 0 ? (
        <p className="filter-note">No operator overrides. Operators inherit their rarity baseline.</p>
      ) : (
        <div className="rulebook-override-grid">
          {overrideIds.map((id) => {
            const operator = operatorById.get(id)
            const storedCost = rulebook.overrides.operatorCosts[id]
            if (!operator) {
              return (
                <article className="rulebook-unresolved-override" key={id}>
                  <strong>{id}</strong>
                  <span>Unresolved operator reference • baseline {storedCost}</span>
                  {!disabled && <button type="button" className="secondary-button" onClick={() => removeOverride(id)}>Remove</button>}
                </article>
              )
            }
            const cost = getDraftRulebookOperatorCostBreakdown(rulebook, operator, dataset.operators)
            return (
              <div className="rulebook-override-card" key={id}>
                <OperatorCard
                  operator={operator}
                  interactionDetails={buildRulebookOperatorInteractionDetails(rulebook, operator, dataset)}
                />
                <div className="rulebook-override-meta">
                  <span>Default rarity cost <strong>{cost.rarityCost}</strong></span>
                  <span>Override <strong>{signed(cost.overrideDelta)}</strong></span>
                  <span>Baseline <strong>{cost.baselineCost}</strong></span>
                  <span>Minimum <strong>{cost.minimumCost}</strong></span>
                  <span>Maximum <strong>{cost.maximumCost}</strong></span>
                  {!disabled && <button type="button" className="secondary-button" onClick={() => removeOverride(id)}>Remove</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

export function draftRulebookOverrideCount(rulebook: DraftRulebook): number {
  return Object.keys(rulebook.overrides.operatorCosts).length
}
