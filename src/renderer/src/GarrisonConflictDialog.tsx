import { useMemo } from 'react'
import type { Operator } from '../../shared/operator'
import {
  clearGarrisonOperatorConflicts,
  cloneGarrison,
  getGarrisonConflictOperatorIds,
  getGarrisonOperatorConflicts,
  type Garrison,
} from '../../shared/garrison'

export default function GarrisonConflictDialog({
  garrison,
  operators,
  onChange,
  onCancel,
  onClearConflict,
}: {
  garrison: Garrison
  operators: readonly Operator[]
  onChange: (garrison: Garrison) => void
  onCancel: () => void
  onClearConflict: (garrison: Garrison) => void
}): React.JSX.Element {
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )
  const conflictIds = useMemo(() => new Set(getGarrisonConflictOperatorIds(garrison)), [garrison])
  const conflicts = useMemo(() => getGarrisonOperatorConflicts(garrison), [garrison])
  const conflictStages = garrison.stages
    .map((stage) => ({
      stage,
      operatorIds: stage.operatorIds.filter((operatorId) => conflictIds.has(operatorId)),
    }))
    .filter((entry) => entry.operatorIds.length > 0)

  const updateStage = (stageId: string, operatorIds: string[]): void => {
    const next = cloneGarrison(garrison)
    next.stages = next.stages.map((stage) =>
      stage.id === stageId ? { ...stage, operatorIds } : stage,
    )
    onChange(next)
  }

  return (
    <div className="slot-editor-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="slot-editor garrison-conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garrison-conflict-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="slot-editor-heading">
          <div>
            <p className="eyebrow">GARRISON</p>
            <h3 id="garrison-conflict-title">Conflict detected</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close conflict dialog"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <p className="garrison-conflict-intro">
          Cross-stage duplicate prevention requires every operator to belong to at most one stage.
          Choose which assignments to remove, or use Clear Conflict to keep each operator's first
          stage assignment in document order.
        </p>

        <div className="garrison-conflict-summary" aria-label="Conflicting operators and stages">
          {conflicts.map((conflict) => {
            const label = operatorById.get(conflict.operatorId)?.name ?? conflict.operatorId
            return (
              <div className="garrison-conflict-summary-row" key={conflict.operatorId}>
                <strong>{label}</strong>
                <span>{conflict.stageNames.join(' · ')}</span>
              </div>
            )
          })}
        </div>

        <div className="garrison-conflict-table" role="table" aria-label="Operator conflicts">
          <div className="garrison-conflict-row garrison-conflict-row--header" role="row">
            <span role="columnheader">Stage</span>
            <span role="columnheader">Action</span>
          </div>
          {conflictStages.map(({ stage, operatorIds }) => (
            <div className="garrison-conflict-row" role="row" key={stage.id}>
              <div className="garrison-conflict-stage" role="cell">
                <strong>{stage.name}</strong>
                <div className="garrison-conflict-operators">
                  {operatorIds.map((operatorId) => (
                    <span
                      className="garrison-conflict-operator"
                      key={operatorId}
                      title={operatorId}
                    >
                      {operatorById.get(operatorId)?.name ?? operatorId}
                    </span>
                  ))}
                </div>
              </div>
              <div className="garrison-conflict-actions" role="cell">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    updateStage(
                      stage.id,
                      stage.operatorIds.filter((operatorId) => !conflictIds.has(operatorId)),
                    )
                  }
                >
                  Remove Conflicting Operator
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => updateStage(stage.id, [])}
                >
                  Clear Squad
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="garrison-conflict-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="randomize-button"
            onClick={() =>
              onClearConflict(
                conflicts.length > 0
                  ? clearGarrisonOperatorConflicts(garrison)
                  : cloneGarrison(garrison),
              )
            }
          >
            Clear Conflict
          </button>
        </div>
      </div>
    </div>
  )
}
