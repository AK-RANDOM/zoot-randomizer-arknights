import { useEffect, useMemo, useState } from 'react'
import {
  rarityGroupDefinitions,
  type RandomizerConstraints,
  type SlotConstraint,
} from '../../shared/constraints'
import {
  operatorClasses,
  operatorRarities,
  type Operator,
  type OperatorClass,
  type OperatorRarity,
} from '../../shared/operator'
import {
  canSlotResolveTo,
  constraintsWithSlotDraft,
  filterEligibleOperators,
  operatorMatchesSlotConstraint,
  validateConstraints,
} from '../../shared/randomizer'

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}

export default function SquadConstraintEditor({
  slotIndex,
  value,
  constraints,
  operators,
  classLabels,
  onApply,
  onClose,
}: {
  slotIndex: number
  value: SlotConstraint
  constraints: RandomizerConstraints
  operators: Operator[]
  classLabels?: Readonly<Record<OperatorClass, string>>
  onApply: (value: SlotConstraint) => void
  onClose: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<SlotConstraint>({
    rarities: [...value.rarities],
    classes: [...value.classes],
  })

  useEffect(() => {
    setDraft({ rarities: [...value.rarities], classes: [...value.classes] })
  }, [slotIndex, value])

  const eligiblePool = useMemo(
    () => filterEligibleOperators(operators, constraints),
    [constraints, operators],
  )

  const draftConstraints = useMemo(
    () => constraintsWithSlotDraft(constraints, slotIndex, draft),
    [constraints, draft, slotIndex],
  )

  const validation = useMemo(
    () => validateConstraints(draftConstraints, operators),
    [draftConstraints, operators],
  )

  const candidateCount = useMemo(
    () =>
      eligiblePool.filter((operator) => operatorMatchesSlotConstraint(operator, draft))
        .length,
    [draft, eligiblePool],
  )

  const rarityAvailability = useMemo(() => {
    return new Map(
      operatorRarities.map((rarity) => {
        const forced: SlotConstraint = { ...draft, rarities: [rarity] }
        const directCandidates = eligiblePool.filter((operator) =>
          operatorMatchesSlotConstraint(operator, forced),
        ).length
        const valid =
          directCandidates > 0 &&
          canSlotResolveTo(operators, constraints, slotIndex, draft, { rarity })
        return [
          rarity,
          {
            valid,
            reason:
              directCandidates === 0
                ? 'No eligible operator matches this rarity with the current class criteria.'
                : valid
                  ? ''
                  : 'This rarity cannot participate in any full squad under the current squad bounds.',
          },
        ] as const
      }),
    )
  }, [constraints, draft, eligiblePool, operators, slotIndex])

  const classAvailability = useMemo(() => {
    return new Map(
      operatorClasses.map((operatorClass) => {
        const forced: SlotConstraint = { ...draft, classes: [operatorClass] }
        const directCandidates = eligiblePool.filter((operator) =>
          operatorMatchesSlotConstraint(operator, forced),
        ).length
        const valid =
          directCandidates > 0 &&
          canSlotResolveTo(operators, constraints, slotIndex, draft, { operatorClass })
        return [
          operatorClass,
          {
            valid,
            reason:
              directCandidates === 0
                ? 'No eligible operator matches this class with the current rarity criteria.'
                : valid
                  ? ''
                  : 'This class cannot participate in any full squad under the current squad bounds.',
          },
        ] as const
      }),
    )
  }, [constraints, draft, eligiblePool, operators, slotIndex])

  const setRaritySet = (rarities: readonly OperatorRarity[]): void => {
    setDraft((current) => ({ ...current, rarities: [...rarities] }))
  }

  return (
    <div className="slot-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="slot-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="slot-editor-heading">
          <div>
            <p className="eyebrow">SLOT CONSTRAINT</p>
            <h3 id="slot-editor-title">Slot {slotIndex + 1}</h3>
          </div>
          <button type="button" className="icon-button" aria-label="Close slot editor" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="slot-editor-section">
          <div className="slot-editor-label-row">
            <strong>Rarity</strong>
            <span>{draft.rarities.length === 0 ? 'Any rarity' : 'OR within selected rarities'}</span>
          </div>
          <div className="criteria-chip-row" aria-label="Allowed rarities">
            {operatorRarities.map((rarity) => {
              const selected = draft.rarities.includes(rarity)
              const availability = rarityAvailability.get(rarity)!
              const disabled = !selected && !availability.valid
              return (
                <button
                  key={rarity}
                  type="button"
                  className={`criteria-chip${selected ? ' is-selected' : ''}${!availability.valid ? ' is-unavailable' : ''}`}
                  aria-pressed={selected}
                  disabled={disabled}
                  title={availability.reason || `${rarity} star is available`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      rarities: toggleValue(current.rarities, rarity),
                    }))
                  }
                >
                  {rarity}★
                </button>
              )
            })}
          </div>
          <div className="quick-select-row">
            <span>Quick select</span>
            {(['lte3', 'lte4', 'lte5', 'gte4', 'gte5'] as const).map((group) => {
              const definition = rarityGroupDefinitions[group]
              const selected = sameSet(draft.rarities, definition.rarities)
              return (
                <button
                  key={group}
                  type="button"
                  className={`quick-select${selected ? ' is-selected' : ''}`}
                  onClick={() => setRaritySet(definition.rarities)}
                >
                  {definition.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="slot-editor-section">
          <div className="slot-editor-label-row">
            <strong>Class</strong>
            <span>{draft.classes.length === 0 ? 'Any class' : 'OR within selected classes'}</span>
          </div>
          <div className="criteria-chip-grid" aria-label="Allowed classes">
            {operatorClasses.map((operatorClass) => {
              const selected = draft.classes.includes(operatorClass)
              const availability = classAvailability.get(operatorClass)!
              const disabled = !selected && !availability.valid
              const displayClass = classLabels?.[operatorClass] ?? operatorClass
              return (
                <button
                  key={operatorClass}
                  type="button"
                  className={`criteria-chip criteria-chip--class${selected ? ' is-selected' : ''}${!availability.valid ? ' is-unavailable' : ''}`}
                  aria-pressed={selected}
                  disabled={disabled}
                  title={availability.reason || `${displayClass} is available`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      classes: toggleValue<OperatorClass>(current.classes, operatorClass),
                    }))
                  }
                >
                  {displayClass}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`slot-feasibility${validation.valid ? ' is-valid' : ' is-invalid'}`}>
          {validation.valid ? (
            <span>✓ {candidateCount} eligible operator{candidateCount === 1 ? '' : 's'} match this slot; a complete squad remains feasible.</span>
          ) : (
            <span>⚠ {validation.errors[0] ?? 'This slot cannot participate in a complete valid squad.'}</span>
          )}
        </div>

        <div className="slot-editor-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft({ rarities: [], classes: [] })}
          >
            Reset to Any
          </button>
          <span className="slot-editor-spacer" />
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="randomize-button"
            disabled={!validation.valid}
            onClick={() => onApply(draft)}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
