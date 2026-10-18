import { useMemo, useState } from 'react'
import type { Operator } from '../../shared/operator'
import {
  GARRISON_STAGE_CAPACITY,
  normalizeGarrisonStageOperatorIds,
  type GarrisonStage,
} from '../../shared/garrison'
import OperatorSelector, { type OperatorSelectorOption } from './OperatorSelector'
import { DraftEmptySlotFrame, DraftRosterAvatar } from './DraftSquadGrid'

const PRIMARY_SLOT_COUNT = GARRISON_STAGE_CAPACITY - 1

type StageEditorMode = 'new' | 'existing'

function StageNameInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="garrison-stage-editor-title">
      <span className="sr-only">Stage name</span>
      <input
        type="text"
        value={value}
        placeholder="Stage name"
        aria-label="Stage name"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function conflictReason(stageNames: readonly string[]): string {
  if (stageNames.length === 1) return `Already assigned to ${stageNames[0]}`
  return `Already assigned to ${stageNames.join(', ')}`
}

export default function GarrisonStageEditor({
  mode,
  stage,
  otherStages,
  duplicateOperatorsAllowed,
  alterExclusivity,
  operators,
  eligibleOperators,
  onChange,
  onCancel,
  onConfirm,
}: {
  mode: StageEditorMode
  stage: GarrisonStage
  otherStages: readonly GarrisonStage[]
  duplicateOperatorsAllowed: boolean
  alterExclusivity: boolean
  operators: readonly Operator[]
  eligibleOperators: readonly Operator[]
  onChange: (stage: GarrisonStage) => void
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null)
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )
  const editingOperatorId =
    editingSlotIndex === null ? null : (stage.operatorIds[editingSlotIndex] ?? null)

  const crossStageAssignments = useMemo(() => {
    const stagesByOperator = new Map<string, string[]>()
    if (duplicateOperatorsAllowed) return stagesByOperator

    for (const otherStage of otherStages) {
      for (const operatorId of new Set(otherStage.operatorIds)) {
        const stageNames = stagesByOperator.get(operatorId) ?? []
        stageNames.push(otherStage.name)
        stagesByOperator.set(operatorId, stageNames)
      }
    }
    return stagesByOperator
  }, [duplicateOperatorsAllowed, otherStages])

  const operatorOptions = useMemo<OperatorSelectorOption[]>(() => {
    const reservedInStage = new Set(
      stage.operatorIds.filter((operatorId, index) => index !== editingSlotIndex && operatorId),
    )
    const reservedAlterGroups = new Set(
      stage.operatorIds
        .filter((_, index) => index !== editingSlotIndex)
        .map((operatorId) => operatorById.get(operatorId)?.alterGroup)
        .filter((group): group is string => Boolean(group)),
    )

    return eligibleOperators
      .map((operator) => {
        const conflictingStages = crossStageAssignments.get(operator.id) ?? []
        const reason = reservedInStage.has(operator.id)
          ? 'Already picked in this stage'
          : alterExclusivity && operator.alterGroup && reservedAlterGroups.has(operator.alterGroup)
            ? 'Alter of an operator already picked in this stage'
            : conflictingStages.length > 0
              ? conflictReason(conflictingStages)
              : undefined
        return {
          key: operator.id,
          label: operator.name,
          operator,
          aliases: [operator.subclass.name],
          disabled: Boolean(reason),
          disabledReason: reason,
        }
      })
      .sort(
        (left, right) =>
          right.operator.rarity - left.operator.rarity || left.label.localeCompare(right.label),
      )
  }, [
    alterExclusivity,
    crossStageAssignments,
    editingSlotIndex,
    eligibleOperators,
    operatorById,
    stage.operatorIds,
  ])

  const replaceSlot = (slotIndex: number, operatorId: string): void => {
    const next = [...stage.operatorIds]
    if (slotIndex < next.length) next[slotIndex] = operatorId
    else next.push(operatorId)
    onChange({ ...stage, operatorIds: normalizeGarrisonStageOperatorIds(next) })
  }

  const clearSlot = (slotIndex: number): void => {
    onChange({
      ...stage,
      operatorIds: normalizeGarrisonStageOperatorIds(
        stage.operatorIds.filter((_, index) => index !== slotIndex),
      ),
    })
    if (editingSlotIndex === slotIndex) setEditingSlotIndex(null)
  }

  const openSlot = (slotIndex: number): void => {
    const occupied = Boolean(stage.operatorIds[slotIndex])
    if (!occupied && stage.operatorIds.length >= GARRISON_STAGE_CAPACITY) return
    setEditingSlotIndex(slotIndex)
  }

  const rosterSlot = (slotIndex: number): React.JSX.Element => {
    const operatorId = stage.operatorIds[slotIndex]
    const operator = operatorId ? (operatorById.get(operatorId) ?? null) : null
    const slotNumber = slotIndex + 1

    return (
      <div
        className="draft-squad-slot draft-squad-slot--valid garrison-stage-slot is-interactive standard-slot-action-card"
        key={slotNumber}
        role="button"
        tabIndex={0}
        aria-label={`Stage squad slot ${slotNumber}: ${operator?.name ?? (operatorId || 'open')}`}
        onClick={() => openSlot(slotIndex)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          openSlot(slotIndex)
        }}
      >
        {operator ? (
          <DraftRosterAvatar operator={operator} />
        ) : operatorId ? (
          <div className="draft-squad-slot__frame draft-squad-slot__frame--valid garrison-unresolved-slot">
            <span className="draft-squad-slot__number">{slotNumber}</span>
            <strong>{operatorId}</strong>
          </div>
        ) : (
          <DraftEmptySlotFrame slotNumber={slotNumber} variant="valid" />
        )}
        <div
          className="standard-slot-actions-overlay"
          aria-label={`Actions for stage slot ${slotNumber}`}
        >
          <div className="draft-operator-actions">
            <button
              type="button"
              className="draft-operator-action draft-operator-action--pick"
              onClick={(event) => {
                event.stopPropagation()
                openSlot(slotIndex)
              }}
            >
              {operatorId ? 'Modify' : 'Add'}
            </button>
            {operatorId && (
              <button
                type="button"
                className="draft-operator-action draft-operator-action--hold-cost"
                onClick={(event) => {
                  event.stopPropagation()
                  clearSlot(slotIndex)
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section
      className="garrison-stage-editor"
      aria-label={`${mode === 'new' ? 'Add' : 'Edit'} Garrison stage`}
    >
      <div className="draft-selected-squad">
        <StageNameInput value={stage.name} onChange={(name) => onChange({ ...stage, name })} />

        <div className="draft-squad-layout draft-squad-layout--with-capacity">
          <div className="draft-squad-grid" aria-label="Garrison stage squad slots 1 through 12">
            {Array.from({ length: PRIMARY_SLOT_COUNT }, (_, slotIndex) => rosterSlot(slotIndex))}
          </div>

          <div className="draft-squad-capacity-column garrison-stage-editor-side">
            <div
              className="garrison-stage-editor-thirteenth"
              aria-label="Garrison stage squad slot 13"
            >
              {rosterSlot(PRIMARY_SLOT_COUNT)}
            </div>
            <div className="garrison-stage-editor-actions" aria-label="Stage editor actions">
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="randomize-button" onClick={onConfirm}>
                Confirm Stage
              </button>
            </div>
          </div>
        </div>
      </div>

      {editingSlotIndex !== null && (
        <div
          className="slot-editor-backdrop"
          role="presentation"
          onMouseDown={() => setEditingSlotIndex(null)}
        >
          <div
            className="slot-editor garrison-operator-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="garrison-operator-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="slot-editor-heading">
              <div>
                <p className="eyebrow">GARRISON OPERATOR</p>
                <h3 id="garrison-operator-picker-title">
                  {editingOperatorId ? 'Modify' : 'Add'} slot {editingSlotIndex + 1}
                </h3>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close operator picker"
                onClick={() => setEditingSlotIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="slot-editor-section garrison-operator-picker-search">
              <OperatorSelector
                options={operatorOptions}
                valueKey={null}
                includeInternalId={false}
                placeholder="Search eligible operators…"
                onSelect={(option) => {
                  if (!option || option.disabled) return
                  replaceSlot(editingSlotIndex, option.operator.id)
                  setEditingSlotIndex(null)
                }}
              />
              {!duplicateOperatorsAllowed && (
                <small className="garrison-operator-picker-note">
                  Operators already assigned to another stage remain visible but unavailable.
                </small>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
