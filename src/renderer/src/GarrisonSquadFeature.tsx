import { useEffect, useMemo, useState } from 'react'
import type { Operator } from '../../shared/operator'
import {
  cloneGarrison,
  cloneGarrisonStage,
  createGarrison,
  createGarrisonStage,
  garrisonEquals,
  getGarrisonParticipation,
  garrisonHasOperatorConflicts,
  type Garrison,
  type GarrisonStage,
} from '../../shared/garrison'
import GarrisonConflictDialog from './GarrisonConflictDialog'
import GarrisonStageEditor from './GarrisonStageEditor'
import { useOperatorAppearanceAvatar } from './operatorAppearance'
import TextInputDialog from './TextInputDialog'
import { loadSavedGarrisons, saveSavedGarrisons } from './rendererPersistence'

type NameDialogMode = 'duplicate' | 'rename'
type StageEditorState = {
  mode: 'new' | 'existing'
  stage: GarrisonStage
  undo: GarrisonStage | null
  redo: GarrisonStage | null
}

type ConflictPurpose = 'stage-confirm' | 'disable-cross-stage-duplicates'

function nextStageName(stages: readonly { name: string }[]): string {
  const used = new Set(stages.map((stage) => stage.name.trim().toLowerCase()))
  let index = stages.length + 1
  while (used.has(`stage ${index}`)) index += 1
  return `Stage ${index}`
}

function stageEquals(left: GarrisonStage, right: GarrisonStage): boolean {
  return JSON.stringify(cloneGarrisonStage(left)) === JSON.stringify(cloneGarrisonStage(right))
}

function GarrisonStageOperatorIcon({ operator }: { operator: Operator }): React.JSX.Element {
  const { imageUrl } = useOperatorAppearanceAvatar(operator)

  return (
    <span
      className="release-representative draft-history__operator-icon"
      data-rarity={operator.rarity}
      title={`${operator.name} — ${operator.rarity}★`}
      aria-label={`${operator.name}, ${operator.rarity} star`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span aria-hidden="true">{operator.name.slice(0, 1)}</span>
      )}
    </span>
  )
}

export default function GarrisonSquadFeature({
  operators,
  eligibleOperators,
  onDirtyChange,
  onMessage,
}: {
  operators: readonly Operator[]
  eligibleOperators: readonly Operator[]
  onDirtyChange: (dirty: boolean) => void
  onMessage: (message: string) => void
}): React.JSX.Element {
  const [library, setLibrary] = useState<Garrison[]>(() => loadSavedGarrisons())
  const [working, setWorking] = useState<Garrison>(() => createGarrison())
  const [baseline, setBaseline] = useState<Garrison>(() => cloneGarrison(working))
  const [selectedGarrisonId, setSelectedGarrisonId] = useState<string | null>(null)
  const [undoWorking, setUndoWorking] = useState<Garrison | null>(null)
  const [redoWorking, setRedoWorking] = useState<Garrison | null>(null)
  const [stageEditor, setStageEditor] = useState<StageEditorState | null>(null)
  const [conflictDraft, setConflictDraft] = useState<Garrison | null>(null)
  const [conflictPurpose, setConflictPurpose] = useState<ConflictPurpose | null>(null)
  const [nameDialog, setNameDialog] = useState<{
    mode: NameDialogMode
    initialValue: string
  } | null>(null)

  const selectedGarrison = useMemo(
    () => library.find((garrison) => garrison.id === selectedGarrisonId) ?? null,
    [library, selectedGarrisonId],
  )
  const dirty = useMemo(() => !garrisonEquals(working, baseline), [baseline, working])
  const hasUnsavedChanges = dirty || stageEditor !== null || conflictDraft !== null
  const operatorById = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator] as const)),
    [operators],
  )
  const participation = useMemo(() => getGarrisonParticipation(working), [working])
  const canUndo = stageEditor ? stageEditor.undo !== null : undoWorking !== null
  const canRedo = stageEditor ? stageEditor.redo !== null : redoWorking !== null

  useEffect(() => {
    saveSavedGarrisons(library)
  }, [library])

  useEffect(() => {
    onDirtyChange(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const resetHistory = (): void => {
    setUndoWorking(null)
    setRedoWorking(null)
  }

  const applyWorkingEdit = (next: Garrison): void => {
    if (garrisonEquals(working, next)) return
    setUndoWorking(cloneGarrison(working))
    setRedoWorking(null)
    setWorking(cloneGarrison(next))
  }

  const beginNewGarrison = (): void => {
    const next = createGarrison()
    setWorking(next)
    setBaseline(cloneGarrison(next))
    setSelectedGarrisonId(null)
    setStageEditor(null)
    setConflictDraft(null)
    setConflictPurpose(null)
    resetHistory()
    onMessage('Started a new Garrison.')
  }

  const confirmDiscardIfNeeded = (action: () => void): boolean => {
    if (
      hasUnsavedChanges &&
      !window.confirm('Discard unsaved Garrison changes? Your saved Garrisons will not be changed.')
    )
      return false
    action()
    return true
  }

  const loadGarrison = (garrison: Garrison): void => {
    const next = cloneGarrison(garrison)
    setWorking(next)
    setBaseline(cloneGarrison(next))
    setSelectedGarrisonId(garrison.id)
    setStageEditor(null)
    setConflictDraft(null)
    setConflictPurpose(null)
    resetHistory()
    onMessage(`Opened Garrison “${garrison.name}”.`)
  }

  const persistGarrison = (candidate: Garrison, recordUndo = false): void => {
    const normalizedName = candidate.name.trim() || 'Untitled Garrison'
    const saved = cloneGarrison({ ...candidate, name: normalizedName })
    if (recordUndo && !garrisonEquals(working, saved)) {
      setUndoWorking(cloneGarrison(working))
      setRedoWorking(null)
    }
    setWorking(saved)
    setBaseline(cloneGarrison(saved))
    setSelectedGarrisonId(saved.id)
    setConflictDraft(null)
    setConflictPurpose(null)
    setLibrary((current) => {
      const existingIndex = current.findIndex((garrison) => garrison.id === saved.id)
      if (existingIndex < 0) return [...current, saved]
      return current.map((garrison) => (garrison.id === saved.id ? saved : garrison))
    })
    onMessage(
      selectedGarrison
        ? `Saved changes to Garrison “${saved.name}”.`
        : `Saved Garrison “${saved.name}”.`,
    )
  }

  const saveGarrison = (): void => {
    if (stageEditor || conflictDraft) return
    persistGarrison(
      cloneGarrison({
        ...working,
        name: working.name.trim() || 'Untitled Garrison',
      }),
    )
  }

  const deleteSelectedGarrison = (): void => {
    if (!selectedGarrison || stageEditor || conflictDraft) return
    const extra = dirty ? ' Unsaved working changes will also be discarded.' : ''
    if (!window.confirm(`Delete Garrison “${selectedGarrison.name}”?${extra}`)) return
    setLibrary((current) => current.filter((garrison) => garrison.id !== selectedGarrison.id))
    const deletedName = selectedGarrison.name
    const next = createGarrison()
    setWorking(next)
    setBaseline(cloneGarrison(next))
    setSelectedGarrisonId(null)
    resetHistory()
    onMessage(`Deleted Garrison “${deletedName}”.`)
  }

  const confirmNameDialog = (name: string): void => {
    const action = nameDialog
    if (!action) return
    setNameDialog(null)
    if (action.mode === 'rename') {
      applyWorkingEdit({ ...working, name })
      onMessage('Garrison renamed in the working copy. Save Garrison to keep the change.')
      return
    }

    const duplicate = cloneGarrison(working)
    duplicate.id = createGarrison(name).id
    duplicate.name = name.trim() || `${working.name} copy`
    duplicate.stages = duplicate.stages.map((stage) => ({
      ...stage,
      id: createGarrisonStage(stage.name).id,
    }))
    setLibrary((current) => [...current, duplicate])
    setWorking(duplicate)
    setBaseline(cloneGarrison(duplicate))
    setSelectedGarrisonId(duplicate.id)
    resetHistory()
    onMessage(`Duplicated Garrison as “${duplicate.name}”.`)
  }

  const changeDuplicatePolicy = (allowDuplicates: boolean): void => {
    if (stageEditor || conflictDraft || allowDuplicates === working.duplicateOperatorsAllowed)
      return

    const next = cloneGarrison({ ...working, duplicateOperatorsAllowed: allowDuplicates })
    if (!allowDuplicates && garrisonHasOperatorConflicts(next)) {
      setConflictDraft(next)
      setConflictPurpose('disable-cross-stage-duplicates')
      onMessage(
        'Cross-stage duplicates already exist. Resolve them before duplicate prevention can become active.',
      )
      return
    }

    applyWorkingEdit(next)
    onMessage(
      allowDuplicates
        ? 'Operators may now be reused across stages. Save Garrison to keep the change.'
        : 'Cross-stage duplicate prevention enabled. Save Garrison to keep the change.',
    )
  }

  const addStage = (): void => {
    if (stageEditor || conflictDraft) return
    setStageEditor({
      mode: 'new',
      stage: createGarrisonStage(nextStageName(working.stages)),
      undo: null,
      redo: null,
    })
  }

  const editStage = (stage: GarrisonStage): void => {
    if (stageEditor || conflictDraft) return
    setStageEditor({
      mode: 'existing',
      stage: cloneGarrisonStage(stage),
      undo: null,
      redo: null,
    })
  }

  const changeStageEditor = (stage: GarrisonStage): void => {
    setStageEditor((current) => {
      if (!current || stageEquals(current.stage, stage)) return current
      return {
        ...current,
        stage: cloneGarrisonStage(stage),
        undo: cloneGarrisonStage(current.stage),
        redo: null,
      }
    })
  }

  const confirmStageEditor = (): void => {
    if (!stageEditor) return
    const committed = cloneGarrisonStage({
      ...stageEditor.stage,
      name: stageEditor.stage.name.trim() || 'Untitled Stage',
    })
    const next = cloneGarrison(working)
    next.stages =
      stageEditor.mode === 'new'
        ? [...next.stages, committed]
        : next.stages.map((stage) => (stage.id === committed.id ? committed : stage))

    if (!next.duplicateOperatorsAllowed && garrisonHasOperatorConflicts(next)) {
      setConflictDraft(next)
      setConflictPurpose('stage-confirm')
      onMessage('Conflict detected. Resolve repeated operators before confirming this stage.')
      return
    }

    const mode = stageEditor.mode
    setStageEditor(null)
    applyWorkingEdit(next)
    onMessage(
      `${mode === 'new' ? 'Added' : 'Updated'} stage “${committed.name}” in the working Garrison. Save Garrison to keep the change.`,
    )
  }

  const cancelStageEditor = (): void => {
    if (!stageEditor) return
    const mode = stageEditor.mode
    setStageEditor(null)
    onMessage(
      mode === 'new'
        ? 'Canceled new stage; no stage was added.'
        : 'Canceled stage edits; the working Garrison was not changed.',
    )
  }

  const renameStage = (stageId: string, name: string): void => {
    if (stageEditor || conflictDraft) return
    const next = cloneGarrison(working)
    next.stages = next.stages.map((stage) => (stage.id === stageId ? { ...stage, name } : stage))
    applyWorkingEdit(next)
  }

  const deleteStage = (stageId: string): void => {
    if (stageEditor || conflictDraft) return
    const stage = working.stages.find((candidate) => candidate.id === stageId)
    if (!stage) return
    if (
      stage.operatorIds.length > 0 &&
      !window.confirm(
        `Delete stage “${stage.name}” and its ${stage.operatorIds.length} assigned operator${stage.operatorIds.length === 1 ? '' : 's'}?`,
      )
    )
      return
    const next = cloneGarrison(working)
    next.stages = next.stages.filter((candidate) => candidate.id !== stageId)
    applyWorkingEdit(next)
    onMessage(
      `Deleted stage “${stage.name}” from the working Garrison. Save Garrison to keep the change.`,
    )
  }

  const undoEdit = (): void => {
    if (conflictDraft) return
    if (stageEditor) {
      if (!stageEditor.undo) return
      setStageEditor((current) =>
        current?.undo
          ? {
              ...current,
              stage: cloneGarrisonStage(current.undo),
              undo: null,
              redo: cloneGarrisonStage(current.stage),
            }
          : current,
      )
      onMessage('Undid the previous stage edit.')
      return
    }
    if (!undoWorking) return
    const previous = cloneGarrison(undoWorking)
    setRedoWorking(cloneGarrison(working))
    setUndoWorking(null)
    setWorking(previous)
    onMessage('Undid the previous Garrison edit.')
  }

  const redoEdit = (): void => {
    if (conflictDraft) return
    if (stageEditor) {
      if (!stageEditor.redo) return
      setStageEditor((current) =>
        current?.redo
          ? {
              ...current,
              stage: cloneGarrisonStage(current.redo),
              undo: cloneGarrisonStage(current.stage),
              redo: null,
            }
          : current,
      )
      onMessage('Redid the previous stage edit.')
      return
    }
    if (!redoWorking) return
    const next = cloneGarrison(redoWorking)
    setUndoWorking(cloneGarrison(working))
    setRedoWorking(null)
    setWorking(next)
    onMessage('Redid the previous Garrison edit.')
  }

  return (
    <>
      <section className="panel squad-panel garrison-panel" aria-labelledby="garrison-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GET SQUAD • GARRISON</p>
            <h2 id="garrison-heading">Garrison Squad</h2>
          </div>
        </div>

        <div className="preset-toolbar garrison-toolbar">
          <span className="preset-toolbar-label">Garrison</span>
          <label className="preset-select">
            <span className="sr-only">Saved Garrison</span>
            <select
              value={selectedGarrisonId ?? 'new'}
              disabled={stageEditor !== null || conflictDraft !== null}
              onChange={(event) => {
                const id = event.target.value
                if (id === 'new') {
                  if (selectedGarrisonId === null) return
                  if (!confirmDiscardIfNeeded(beginNewGarrison)) {
                    event.currentTarget.value = selectedGarrisonId
                  }
                  return
                }
                const garrison = library.find((candidate) => candidate.id === id)
                if (garrison && !confirmDiscardIfNeeded(() => loadGarrison(garrison))) {
                  event.currentTarget.value = selectedGarrisonId ?? 'new'
                }
              }}
            >
              <option value="new">New Garrison</option>
              {library.length > 0 && (
                <optgroup label="Saved">
                  {library.map((garrison) => (
                    <option key={garrison.id} value={garrison.id}>
                      {garrison.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="preset-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={() => confirmDiscardIfNeeded(beginNewGarrison)}
            >
              New
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={() =>
                setNameDialog({ mode: 'duplicate', initialValue: `${working.name} copy` })
              }
            >
              Duplicate
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={() => setNameDialog({ mode: 'rename', initialValue: working.name })}
            >
              Rename
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!canUndo || conflictDraft !== null}
              onClick={undoEdit}
            >
              Undo
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!canRedo || conflictDraft !== null}
              onClick={redoEdit}
            >
              Redo
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!selectedGarrison || stageEditor !== null || conflictDraft !== null}
              onClick={deleteSelectedGarrison}
            >
              Delete
            </button>
            <span className="preset-actions-spacer" aria-hidden="true" />
            <button
              type="button"
              className="randomize-button"
              disabled={
                stageEditor !== null ||
                conflictDraft !== null ||
                (selectedGarrison !== null && !dirty)
              }
              onClick={saveGarrison}
            >
              Save Garrison
            </button>
          </div>
        </div>

        <div className="garrison-document-heading">
          <label className="garrison-name-field">
            <span>Garrison name</span>
            <input
              type="text"
              value={working.name}
              disabled={stageEditor !== null || conflictDraft !== null}
              onChange={(event) => applyWorkingEdit({ ...working, name: event.target.value })}
            />
          </label>
          <div className="garrison-document-controls">
            <label className="garrison-repeat-toggle">
              <input
                type="checkbox"
                checked={working.duplicateOperatorsAllowed}
                disabled={stageEditor !== null || conflictDraft !== null}
                onChange={(event) => changeDuplicatePolicy(event.target.checked)}
              />
              <span>Allow Operators in multiple stages</span>
            </label>
            <span
              className={hasUnsavedChanges ? 'garrison-save-state is-dirty' : 'garrison-save-state'}
            >
              {stageEditor
                ? 'Editing stage'
                : conflictDraft
                  ? 'Resolve conflict'
                  : dirty
                    ? 'Unsaved changes'
                    : selectedGarrison
                      ? 'Saved'
                      : 'New'}
            </span>
          </div>
        </div>

        <section className="garrison-participants" aria-labelledby="garrison-participants-heading">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <strong id="garrison-participants-heading">Participating Operators</strong>
            <span style={{ color: '#77777e', fontSize: '0.68rem' }}>
              {participation.length} unique
            </span>
          </div>
          {participation.length === 0 ? (
            <p>No operators assigned yet.</p>
          ) : (
            <div
              className="garrison-participant-list"
              aria-label="Participating operators by stage count"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '9px 2px 3px',
              }}
            >
              {participation.map(({ operatorId, stageCount }) => {
                const operator = operatorById.get(operatorId)
                const label = operator?.name ?? operatorId
                return (
                  <span
                    className="garrison-participant-entry"
                    key={operatorId}
                    title={`${label} — ${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`}
                    style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}
                  >
                    {operator ? (
                      <GarrisonStageOperatorIcon operator={operator} />
                    ) : (
                      <span
                        className="release-representative draft-history__operator-icon garrison-stage-missing-icon"
                        title={operatorId}
                      >
                        ?
                      </span>
                    )}
                    <span
                      className="garrison-participant-count"
                      aria-label={`${stageCount} participating ${stageCount === 1 ? 'stage' : 'stages'}`}
                      style={{
                        position: 'absolute',
                        right: -4,
                        bottom: -4,
                        display: 'grid',
                        minWidth: 19,
                        height: 19,
                        placeItems: 'center',
                        padding: '0 4px',
                        border: '1px solid rgba(255, 255, 255, 0.42)',
                        borderRadius: 999,
                        color: '#fff',
                        background: '#171719',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      ×{stageCount}
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </section>

        <div className="garrison-stage-table" role="table" aria-label="Garrison stages">
          <div className="garrison-stage-row garrison-stage-row--header" role="row">
            <span role="columnheader">Stage name</span>
            <span role="columnheader">Squad</span>
            <span role="columnheader">Actions</span>
          </div>
          {working.stages.length === 0 ? (
            <div className="garrison-empty-stages">No stages yet. Add a stage to begin.</div>
          ) : (
            working.stages.map((stage) => (
              <div className="garrison-stage-row" role="row" key={stage.id}>
                <label className="garrison-stage-name" role="cell">
                  <span className="sr-only">Stage name</span>
                  <input
                    type="text"
                    value={stage.name}
                    disabled={stageEditor !== null || conflictDraft !== null}
                    onChange={(event) => renameStage(stage.id, event.target.value)}
                  />
                </label>
                <div className="garrison-stage-squad-preview" role="cell">
                  {stage.operatorIds.length === 0 ? (
                    <span className="garrison-stage-squad-placeholder">Empty</span>
                  ) : (
                    <div
                      className="garrison-stage-squad-icons"
                      aria-label={`${stage.operatorIds.length} assigned operators`}
                    >
                      {stage.operatorIds.map((operatorId) => {
                        const operator = operatorById.get(operatorId)
                        return operator ? (
                          <GarrisonStageOperatorIcon key={operatorId} operator={operator} />
                        ) : (
                          <span
                            key={operatorId}
                            className="release-representative draft-history__operator-icon garrison-stage-missing-icon"
                            title={operatorId}
                          >
                            ?
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="garrison-stage-actions" role="cell">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={stageEditor !== null || conflictDraft !== null}
                    onClick={() => editStage(stage)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={stageEditor !== null || conflictDraft !== null}
                    onClick={() => deleteStage(stage.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          className="secondary-button garrison-add-stage"
          disabled={stageEditor !== null || conflictDraft !== null}
          onClick={addStage}
        >
          Add Stage
        </button>

        {stageEditor && (
          <GarrisonStageEditor
            mode={stageEditor.mode}
            stage={stageEditor.stage}
            otherStages={working.stages.filter((stage) => stage.id !== stageEditor.stage.id)}
            duplicateOperatorsAllowed={working.duplicateOperatorsAllowed}
            operators={operators}
            eligibleOperators={eligibleOperators}
            onChange={changeStageEditor}
            onCancel={cancelStageEditor}
            onConfirm={confirmStageEditor}
          />
        )}
      </section>

      {nameDialog && (
        <TextInputDialog
          title={nameDialog.mode === 'duplicate' ? 'Duplicate Garrison' : 'Rename Garrison'}
          initialValue={nameDialog.initialValue}
          inputLabel="Garrison name"
          confirmLabel={nameDialog.mode === 'duplicate' ? 'Duplicate' : 'Rename'}
          onCancel={() => setNameDialog(null)}
          onConfirm={confirmNameDialog}
        />
      )}

      {conflictDraft && (
        <GarrisonConflictDialog
          garrison={conflictDraft}
          operators={operators}
          onChange={setConflictDraft}
          onCancel={() => {
            const purpose = conflictPurpose
            setConflictDraft(null)
            setConflictPurpose(null)
            onMessage(
              purpose === 'disable-cross-stage-duplicates'
                ? 'Duplicate prevention was not enabled; existing stage assignments were left unchanged.'
                : 'Conflict resolution canceled; the stage edit is still unconfirmed.',
            )
          }}
          onClearConflict={(resolved) => {
            const purpose = conflictPurpose
            const mode = stageEditor?.mode ?? 'existing'
            const stageName = stageEditor?.stage.name.trim() || 'Untitled Stage'
            setConflictDraft(null)
            setConflictPurpose(null)
            if (purpose === 'disable-cross-stage-duplicates') {
              applyWorkingEdit({ ...resolved, duplicateOperatorsAllowed: false })
              onMessage(
                'Conflicts resolved and cross-stage duplicate prevention enabled. Save Garrison to keep the change.',
              )
              return
            }
            setStageEditor(null)
            applyWorkingEdit(resolved)
            onMessage(
              `Conflicts cleared and ${mode === 'new' ? 'added' : 'updated'} stage “${stageName}” in the working Garrison. Save Garrison to keep the change.`,
            )
          }}
        />
      )}
    </>
  )
}
