import { useEffect, useMemo, useRef, useState } from 'react'
import OperatorSelector, { type OperatorSelectorOption } from './OperatorSelector'
import ClassIcon from './ClassIcon'
import { SubclassIcon } from './FilterAssetIcon'
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
  reservedMandatoryGroupsFromSlotConstraints,
  validateConstraints,
} from '../../shared/randomizer'
import './OperatorFilters.css'
import './SquadConstraintEditor.css'

const AMIYA_MANDATORY_GROUP = 'amiya-forms'
const AMIYA_CLASS_ORDER: readonly OperatorClass[] = ['Caster', 'Guard', 'Medic']
const AMIYA_DEFAULT_CLASS: OperatorClass = 'Caster'

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}

export function resolveSlotClassClick(
  classes: readonly OperatorClass[],
  openClass: OperatorClass | null,
  clickedClass: OperatorClass,
): { classes: OperatorClass[]; openClass: OperatorClass | null } {
  const isActive = classes.includes(clickedClass)

  if (openClass === clickedClass && isActive) {
    return {
      classes: operatorClasses.filter(
        (operatorClass) => operatorClass !== clickedClass && classes.includes(operatorClass),
      ),
      openClass: null,
    }
  }

  if (!isActive) {
    return {
      classes: operatorClasses.filter(
        (operatorClass) => operatorClass === clickedClass || classes.includes(operatorClass),
      ),
      openClass: clickedClass,
    }
  }

  return { classes: [...classes], openClass: clickedClass }
}

function cloneDraft(value: SlotConstraint): SlotConstraint {
  return {
    rarities: [...value.rarities],
    classes: [...value.classes],
    ...(value.subclasses !== undefined ? { subclasses: [...value.subclasses] } : {}),
    operatorId: value.operatorId ?? null,
    mandatoryExclusivityGroup: value.mandatoryExclusivityGroup ?? null,
  }
}

function withoutSpecificOperator(value: SlotConstraint): SlotConstraint {
  return { ...cloneDraft(value), operatorId: null, mandatoryExclusivityGroup: null }
}

function sortAmiyaForms(forms: readonly Operator[]): Operator[] {
  return [...forms].sort((left, right) => {
    const leftIndex = AMIYA_CLASS_ORDER.indexOf(left.class)
    const rightIndex = AMIYA_CLASS_ORDER.indexOf(right.class)
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
  })
}

function normalizeAllowedSubclasses(
  values: Iterable<string>,
  allSubclassIds: readonly string[],
): string[] | undefined {
  const selected = new Set(values)
  const ordered = allSubclassIds.filter((id) => selected.has(id))
  return ordered.length === allSubclassIds.length ? undefined : ordered
}

export default function SquadConstraintEditor({
  slotIndex,
  value,
  constraints,
  operators,
  classLabels,
  resetValue,
  onApply,
  onClose,
}: {
  slotIndex: number
  value: SlotConstraint
  constraints: RandomizerConstraints
  operators: Operator[]
  classLabels?: Readonly<Record<OperatorClass, string>>
  resetValue: SlotConstraint
  onApply: (value: SlotConstraint) => void
  onClose: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<SlotConstraint>(() => cloneDraft(value))
  const [selectedClass, setSelectedClass] = useState<OperatorClass | null>(null)
  const classSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(cloneDraft(value))
    setSelectedClass(null)
  }, [slotIndex, value])

  useEffect(() => {
    const closeSubclassPanel = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && !classSectionRef.current?.contains(target)) {
        setSelectedClass(null)
      }
    }
    document.addEventListener('pointerdown', closeSubclassPanel)
    document.addEventListener('focusin', closeSubclassPanel)
    return () => {
      document.removeEventListener('pointerdown', closeSubclassPanel)
      document.removeEventListener('focusin', closeSubclassPanel)
    }
  }, [])

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

  const subclassesByClass = useMemo(
    () =>
      operatorClasses.map((operatorClass) => {
        const subclasses = new Map<string, string>()
        for (const operator of eligiblePool) {
          if (operator.class === operatorClass) {
            subclasses.set(operator.subclass.id, operator.subclass.name)
          }
        }
        return {
          operatorClass,
          subclasses: [...subclasses.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        }
      }),
    [eligiblePool],
  )
  const allSubclassIds = useMemo(
    () => subclassesByClass.flatMap(({ subclasses }) => subclasses.map(({ id }) => id)),
    [subclassesByClass],
  )
  const operatorLocked = Boolean(draft.operatorId || draft.mandatoryExclusivityGroup)
  const selectedSubclassOptions = selectedClass
    ? (subclassesByClass.find(({ operatorClass }) => operatorClass === selectedClass)?.subclasses ??
      [])
    : []

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
                  ? 'No eligible operator matches this rarity with the current class/subclass/operator criteria.'
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
                  ? 'No eligible operator matches this class with the current rarity/subclass/operator criteria.'
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
      sortAmiyaForms(
        eligiblePool.filter(
          (operator) => operator.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP,
        ),
      ),
    [eligiblePool],
  )

  const operatorOptions = useMemo<OperatorSelectorOption[]>(() => {
    const options: OperatorSelectorOption[] = []
    const matchingAmiyaForms = sortAmiyaForms(
      amiyaForms.filter((operator) =>
        operatorMatchesSlotConstraint(operator, draftWithoutOperator),
      ),
    )
    if (matchingAmiyaForms.length > 0 && !reservedMandatoryGroups.has(AMIYA_MANDATORY_GROUP)) {
      options.push({
        key: `group:${AMIYA_MANDATORY_GROUP}`,
        label: 'Amiya',
        operator:
          matchingAmiyaForms.length === 1
            ? matchingAmiyaForms[0]
            : (amiyaForms.find((operator) => operator.class === AMIYA_DEFAULT_CLASS) ??
              matchingAmiyaForms[0]),
        aliases: amiyaForms.flatMap((operator) => [
          operator.name,
          operator.class,
          operator.subclass.name,
        ]),
        classIcons: matchingAmiyaForms.map((operator) => operator.class),
      })
    }

    for (const operator of eligiblePool) {
      if (operator.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP) continue
      if (!operatorMatchesSlotConstraint(operator, draftWithoutOperator)) continue
      if (
        operator.mandatoryExclusivityGroup &&
        reservedMandatoryGroups.has(operator.mandatoryExclusivityGroup)
      )
        continue
      options.push({
        key: `operator:${operator.id}`,
        label: operator.name,
        operator,
        aliases: [operator.subclass.name],
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

  const toggleSubclass = (subclassId: string): void => {
    setDraft((current) => {
      const allowed =
        current.subclasses === undefined ? [...allSubclassIds] : [...current.subclasses]
      const next = new Set(allowed)
      if (next.has(subclassId)) next.delete(subclassId)
      else next.add(subclassId)
      return { ...current, subclasses: normalizeAllowedSubclasses(next, allSubclassIds) }
    })
  }

  const handleClassClick = (operatorClass: OperatorClass): void => {
    if (operatorLocked) {
      setDraft((current) => ({ ...current, classes: toggleValue(current.classes, operatorClass) }))
      setSelectedClass(null)
      return
    }
    const next = resolveSlotClassClick(draft.classes, selectedClass, operatorClass)
    setDraft((current) => ({ ...current, classes: next.classes }))
    setSelectedClass(next.openClass)
  }

  const selectOperator = (option: OperatorSelectorOption | null): void => {
    if (!option) {
      setDraft((current) => ({ ...current, operatorId: null, mandatoryExclusivityGroup: null }))
      return
    }
    setSelectedClass(null)
    if (option.key === `group:${AMIYA_MANDATORY_GROUP}`) {
      setDraft((current) => ({
        ...current,
        classes: current.classes.length === 0 ? [option.operator.class] : current.classes,
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

  const selectedClassLabel = selectedClass ? (classLabels?.[selectedClass] ?? selectedClass) : null

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

        <div ref={classSectionRef} className="slot-editor-section slot-editor-class-section">
          <div className="slot-editor-label-row">
            <strong>Class &amp; subclass</strong>
            <span>
              {draft.classes.length === 0 ? 'Any class' : 'OR within selected classes'} ·{' '}
              {draft.subclasses === undefined ? 'Any subclass' : 'Filtered subclasses'}
            </span>
          </div>
          <div
            className="slot-constraint-class-selector"
            role="group"
            aria-label="Allowed classes and subclass parent"
          >
            {subclassesByClass.map(({ operatorClass, subclasses }) => {
              const active = draft.classes.includes(operatorClass)
              const open = !operatorLocked && selectedClass === operatorClass
              const availability = classAvailability.get(operatorClass)!
              const disabled = !active && !availability.valid
              const displayClass = classLabels?.[operatorClass] ?? operatorClass
              const enabledSubclassCount = subclasses.filter(
                ({ id }) => draft.subclasses === undefined || draft.subclasses.includes(id),
              ).length
              const hasSubclassFilter = enabledSubclassCount < subclasses.length
              const subclassSummary = hasSubclassFilter
                ? ` · ${enabledSubclassCount} of ${subclasses.length} subclasses active`
                : ''
              const actionSummary = operatorLocked
                ? active
                  ? 'Click to deactivate this class.'
                  : 'Click to activate this class.'
                : open && active
                  ? 'Click again to deactivate this class.'
                  : active
                    ? 'Click to view subclasses.'
                    : 'Click to activate this class and view subclasses.'

              return (
                <button
                  key={operatorClass}
                  type="button"
                  className={`slot-constraint-class-icon-button${active ? ' is-active' : ''}${
                    open ? ' is-open' : ''
                  }${!availability.valid ? ' is-unavailable' : ''}`}
                  aria-pressed={active}
                  aria-expanded={operatorLocked ? false : open}
                  disabled={disabled}
                  title={
                    availability.reason || `${displayClass}${subclassSummary}. ${actionSummary}`
                  }
                  onClick={() => handleClassClick(operatorClass)}
                >
                  <ClassIcon operatorClass={operatorClass} />
                  {hasSubclassFilter && (
                    <span className="slot-constraint-class-subcount" aria-hidden="true">
                      {enabledSubclassCount}
                    </span>
                  )}
                  <span className="sr-only">
                    {displayClass}
                    {subclassSummary}
                  </span>
                </button>
              )
            })}
          </div>
          {!operatorLocked && selectedClass && selectedClassLabel && (
            <div
              className="slot-constraint-subclass-selector"
              role="group"
              aria-label={`${selectedClassLabel} subclasses`}
            >
              {selectedSubclassOptions.map((subclass) => {
                const enabled =
                  draft.subclasses === undefined || draft.subclasses.includes(subclass.id)
                return (
                  <button
                    key={subclass.id}
                    type="button"
                    className={`slot-constraint-subclass-icon-button${enabled ? ' is-active' : ''}`}
                    aria-pressed={enabled}
                    title={`${subclass.name} — ${enabled ? 'active' : 'inactive'}`}
                    onClick={() => toggleSubclass(subclass.id)}
                  >
                    <SubclassIcon id={subclass.id} className="slot-constraint-subclass-icon" />
                    <span className="sr-only">{subclass.name}</span>
                  </button>
                )
              })}
            </div>
          )}
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
            className="danger-button"
            onClick={() => {
              setDraft(cloneDraft(resetValue))
              setSelectedClass(null)
            }}
          >
            Reset Constraint
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