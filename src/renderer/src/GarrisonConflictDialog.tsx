import { useMemo } from 'react'
import type { Operator } from '../../shared/operator'
import {
  cloneGarrison,
  getGarrisonConflictOperatorIds,
  getGarrisonOperatorConflicts,
  type Garrison,
} from '../../shared/garrison'
import { useOperatorAppearanceAvatar } from './operatorAppearance'

function ConflictOperatorIcon({ operator }: { operator: Operator | undefined }): React.JSX.Element {
  // Render a fallback for operators no longer present in the current game dataset.
  return operator ? (
    <KnownConflictOperatorIcon operator={operator} />
  ) : (
    <span className="garrison-conflict-avatar garrison-stage-missing-icon" aria-hidden="true">
      ?
    </span>
  )
}

function KnownConflictOperatorIcon({ operator }: { operator: Operator }): React.JSX.Element {
  const { imageUrl } = useOperatorAppearanceAvatar(operator)
  return imageUrl ? (
    <img className="garrison-conflict-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="garrison-conflict-avatar garrison-stage-missing-icon" aria-hidden="true">
      {operator.name.slice(0, 1)}
    </span>
  )
}

export default function GarrisonConflictDialog({
  garrison,
  operators,
  onChange,
  onCancel,
  onApply,
}: {
  garrison: Garrison
  operators: readonly Operator[]
  onChange: (garrison: Garrison) => void
  onCancel: () => void
  onApply: (garrison: Garrison) => void
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

  const applyChanges = (): void => {
    if (
      conflicts.length > 0 &&
      !window.confirm(
        `${conflicts.length} operator conflict${conflicts.length === 1 ? '' : 's'} remain. ` +
          'Apply these changes anyway? Allow duplicates will remain enabled because assignments are still duplicated.',
      )
    )
      return
    onApply(cloneGarrison(garrison))
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
          Operators assigned to multiple stages are listed below. Click an operator icon to remove
          it from that stage, or use the stage actions. Applying with unresolved conflicts will
          require confirmation and leave Allow duplicates enabled.
        </p>

        <div className="garrison-conflict-summary" aria-label="Conflicting operators and stages">
          {conflicts.map((conflict) => {
            const operator = operatorById.get(conflict.operatorId)
            return (
              <div className="garrison-conflict-summary-row" key={conflict.operatorId}>
                <div className="garrison-conflict-summary-operator">
                  <ConflictOperatorIcon operator={operator} />
                  <strong>{operator?.name ?? conflict.operatorId}</strong>
                </div>
                <span>{conflict.stageNames.join(' · ')}</span>
              </div>
            )
          })}
          {conflicts.length === 0 && (
            <p className="garrison-conflict-resolved">No conflicts remain.</p>
          )}
        </div>

        {conflictStages.length > 0 && (
          <div className="garrison-conflict-table" role="table" aria-label="Operator conflicts">
            <div className="garrison-conflict-row garrison-conflict-row--header" role="row">
              <span role="columnheader">Stage</span>
              <span role="columnheader">Actions</span>
            </div>
            {conflictStages.map(({ stage, operatorIds }) => (
              <div className="garrison-conflict-row" role="row" key={stage.id}>
                <div className="garrison-conflict-stage" role="cell">
                  <strong>{stage.name}</strong>
                  <div className="garrison-conflict-operators">
                    {operatorIds.map((operatorId) => {
                      const operator = operatorById.get(operatorId)
                      return (
                        <button
                          type="button"
                          className="garrison-conflict-operator"
                          key={operatorId}
                          title={`Remove ${operator?.name ?? operatorId} from ${stage.name}`}
                          aria-label={`Remove ${operator?.name ?? operatorId} from ${stage.name}`}
                          onClick={() =>
                            updateStage(
                              stage.id,
                              stage.operatorIds.filter((id) => id !== operatorId),
                            )
                          }
                        >
                          <ConflictOperatorIcon operator={operator} />
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="garrison-conflict-actions" role="cell">
                  <button
                    type="button"
                    className="secondary-button"
                    title={`Remove all conflicting operators from ${stage.name}`}
                    onClick={() =>
                      updateStage(
                        stage.id,
                        stage.operatorIds.filter((id) => !conflictIds.has(id)),
                      )
                    }
                  >
                    Remove All
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    title={`Clear every operator from ${stage.name}`}
                    onClick={() => updateStage(stage.id, [])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="garrison-conflict-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="randomize-button" onClick={applyChanges}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}
