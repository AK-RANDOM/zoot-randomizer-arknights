import { useEffect, useMemo, useState } from 'react'
import OperatorSelector, { type OperatorSelectorOption } from './OperatorSelector'
import {
  createEmptySlotConstraint,
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
  reservedMandatoryGroupsFromSlotConstraints,
  validateConstraints,
} from '../../shared/randomizer'

const AMIYA_MANDATORY_GROUP = 'amiya-forms'

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function cloneDraft(value: SlotConstraint): SlotConstraint {
  return {
    rarities: [...value.rarities],
    classes: [...value.classes],
    operatorId: value.operatorId ?? null,
    mandatoryExclusivityGroup: value.mandatoryExclusivityGroup ?? null,
  }
}

function withoutSpecificOperator(value: SlotConstraint): SlotConstraint {
  return { ...cloneDraft(value), operatorId: null, mandatoryExclusivityGroup: null }
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
  const [draft, setDraft] = useState<SlotConstraint>(() => cloneDraft(value))

  useEffect(() => {
    setDraft(cloneDraft(value))
  }, [slotIndex, value])

  const eligiblePool = useMemo(
    () => filterEligibleOperators(operators, constraints),
    [constraints, operators],
  )
  const byId = useMemo(
    () => new Map(eligiblePool.map((operator) => [operator.id, operator])),
    [eligiblePool],
  )
  const draftWithoutOperator = useMemo(() => withoutSpecificOperator(draft), [draft])
  const reservedMandatoryGroups = useMemo(
    () => reservedMandatoryGroupsFromSlotConstraints(eligiblePool, constraints, slotIndex),
    [constraints, eligiblePool, slotIndex],
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
    () => eligiblePool.filter((operator) => operatorMatchesSlotConstraint(operator, draft)).length,
    [draft, eligiblePool],
  )

  const rarityAvailability = useMemo(
    () =>
      new Map(
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
                  ? 'No eligible operator matches this rarity with the current class/operator criteria.'
                  : valid
                    ? ''
                    : 'This rarity cannot participate in any full squad under the current squad bounds.',
            },
          ] as const
        }),
      ),
    [constraints, draft, eligiblePool, operators, slotIndex],
  )

  const classAvailability = useMemo(
    () =>
      new Map(
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
                  ? 'No eligible operator matches this class with the current rarity/operator criteria.'
                  : valid
                    ? ''
                    : 'This class cannot participate in any full squad under the current squad bounds.',
            },
          ] as const
        }),
      ),
    [constraints, draft, eligiblePool, operators, slotIndex],
  )

  const amiyaForms = useMemo(
    () =>
      eligiblePool.filter(
        (operator) => operator.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP,
      ),
    [eligiblePool],
  )
  const selectedExactOperator = draft.operatorId ? (byId.get(draft.operatorId) ?? null) : null
  const amiyaSelected =
    draft.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP ||
    selectedExactOperator?.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP
  const amiyaLockForms = useMemo(
    () =>
      amiyaForms.filter((operator) =>
        operatorMatchesSlotConstraint(operator, draftWithoutOperator),
      ),
    [amiyaForms, draftWithoutOperator],
  )

  const operatorOptions = useMemo<OperatorSelectorOption[]>(() => {
    const options: OperatorSelectorOption[] = []
    const amiya = amiyaForms[0]
    if (amiya) {
      const matchingForms = amiyaForms.filter((operator) =>
        operatorMatchesSlotConstraint(operator, draftWithoutOperator),
      )
      const groupReserved = reservedMandatoryGroups.has(AMIYA_MANDATORY_GROUP)
      options.push({
        key: `group:${AMIYA_MANDATORY_GROUP}`,
        label: 'Amiya',
        operator: amiya,
        aliases: amiyaForms.flatMap((operator) => [operator.name, operator.class]),
        disabled: groupReserved || matchingForms.length === 0,
        disabledReason: groupReserved
          ? 'Amiya is already reserved by another slot.'
          : matchingForms.length === 0
            ? 'No Amiya form matches the current rarity/class criteria.'
            : undefined,
      })
    }

    for (const operator of eligiblePool) {
      if (operator.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP) continue
      const dimensionsMatch = operatorMatchesSlotConstraint(operator, draftWithoutOperator)
      const groupReserved =
        !!operator.mandatoryExclusivityGroup &&
        reservedMandatoryGroups.has(operator.mandatoryExclusivityGroup)
      options.push({
        key: `operator:${operator.id}`,
        label: operator.name,
        operator,
        disabled: !dimensionsMatch || groupReserved,
        disabledReason: groupReserved
          ? 'A mutually exclusive form is already reserved by another slot.'
          : !dimensionsMatch
            ? 'Does not match the current rarity/class criteria.'
            : undefined,
      })
    }
    return options.sort(
      (left, right) =>
        right.operator.rarity - left.operator.rarity || left.label.localeCompare(right.label),
    )
  }, [amiyaForms, draftWithoutOperator, eligiblePool, reservedMandatoryGroups])

  const operatorSelectionKey = useMemo(() => {
    if (draft.mandatoryExclusivityGroup) return `group:${draft.mandatoryExclusivityGroup}`
    if (!draft.operatorId) return null
    const selected = byId.get(draft.operatorId)
    return selected?.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP
      ? `group:${AMIYA_MANDATORY_GROUP}`
      : `operator:${draft.operatorId}`
  }, [byId, draft.mandatoryExclusivityGroup, draft.operatorId])

  const setRaritySet = (rarities: readonly OperatorRarity[]): void => {
    setDraft((current) => ({ ...current, rarities: [...rarities] }))
  }

  const selectOperator = (option: OperatorSelectorOption | null): void => {
    if (!option) {
      setDraft((current) => ({ ...current, operatorId: null, mandatoryExclusivityGroup: null }))
      return
    }
    if (option.key === `group:${AMIYA_MANDATORY_GROUP}`) {
      setDraft((current) => ({
        ...current,
        operatorId: null,
        mandatoryExclusivityGroup: AMIYA_MANDATORY_GROUP,
      }))
      return
    }
    setDraft((current) => ({
      ...current,
      operatorId: option.operator.id,
      mandatoryExclusivityGroup: null,
    }))
  }

  const setAmiyaMode = (mode: 'random' | 'lock'): void => {
    if (mode === 'random') {
      setDraft((current) => ({
        ...current,
        operatorId: null,
        mandatoryExclusivityGroup: AMIYA_MANDATORY_GROUP,
      }))
      return
    }
    const currentForm = draft.operatorId ? byId.get(draft.operatorId) : null
    const nextForm =
      currentForm?.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP &&
      amiyaLockForms.some((form) => form.id === currentForm.id)
        ? currentForm
        : amiyaLockForms[0]
    if (nextForm)
      setDraft((current) => ({
        ...current,
        operatorId: nextForm.id,
        mandatoryExclusivityGroup: null,
      }))
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
          <button
            type="button"
            className="icon-button"
            aria-label="Close slot editor"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="slot-editor-section">
          <div className="slot-editor-label-row">
            <strong>Rarity</strong>
            <span>
              {draft.rarities.length === 0 ? 'Any rarity' : 'OR within selected rarities'}
            </span>
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

        <div className="slot-editor-section">
          <div className="slot-editor-label-row">
            <strong>Specific Operator</strong>
            <span>Optional · searches the current eligible pool</span>
          </div>
          <OperatorSelector
            options={operatorOptions}
            valueKey={operatorSelectionKey}
            onSelect={selectOperator}
          />
          {amiyaSelected && (
            <div className="amiya-form-control">
              <div className="slot-editor-label-row">
                <strong>Amiya form</strong>
                <span>All forms share one mandatory-exclusive identity</span>
              </div>
              <div className="amiya-mode-row">
                <label>
                  <input
                    type="radio"
                    name="amiya-form-mode"
                    checked={draft.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP}
                    onChange={() => setAmiyaMode('random')}
                  />{' '}
                  Randomize Form
                </label>
                <label>
                  <input
                    type="radio"
                    name="amiya-form-mode"
                    checked={!!draft.operatorId}
                    onChange={() => setAmiyaMode('lock')}
                    disabled={amiyaLockForms.length === 0}
                  />{' '}
                  Lock Form
                </label>
              </div>
              {!!draft.operatorId && (
                <label className="amiya-form-select">
                  <span>Form</span>
                  <select
                    value={draft.operatorId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        operatorId: event.target.value,
                        mandatoryExclusivityGroup: null,
                      }))
                    }
                  >
                    {amiyaLockForms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {classLabels?.[form.class] ?? form.class}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>

        <div className={`slot-feasibility${validation.valid ? ' is-valid' : ' is-invalid'}`}>
          {validation.valid ? (
            <span>
              ✓ {candidateCount} eligible operator{candidateCount === 1 ? '' : 's'} match this slot;
              a complete squad remains feasible.
            </span>
          ) : (
            <span>
              ⚠ {validation.errors[0] ?? 'This slot cannot participate in a complete valid squad.'}
            </span>
          )}
        </div>

        <div className="slot-editor-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft(createEmptySlotConstraint())}
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
