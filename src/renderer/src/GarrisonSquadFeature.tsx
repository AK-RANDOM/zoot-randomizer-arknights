import { useAppDialogs } from './AppDialogs'
import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import type { GameLocale, Operator, ReleaseServer } from '../../shared/operator'
import {
  appendEventStages,
  availableGarrisonEventStageTypes,
  type GarrisonEvent,
  type GarrisonEventStageType,
} from '../../shared/garrisonEventCatalog'
import {
  cloneGarrison,
  cloneGarrisonStage,
  clearAllGarrisonSquads,
  clearGarrisonStageSquad,
  createGarrison,
  createGarrisonStage,
  garrisonEquals,
  getGarrisonParticipation,
  garrisonHasOperatorConflicts,
  reorderGarrisonStages,
  normalizeGarrisonStageOperatorIds,
  type Garrison,
  type GarrisonStage,
} from '../../shared/garrison'
import { garrisonEventHelperOperator } from '../../shared/garrisonEventHelper'
import EventSelectorDropdown from './EventSelectorDropdown'
import GarrisonConflictDialog from './GarrisonConflictDialog'
import GarrisonStageEditor from './GarrisonStageEditor'
import GarrisonSquadMethodDialog from './GarrisonSquadMethodDialog'
import { garrisonDispatchExclusions, type GarrisonDispatchRequest } from './garrisonDispatch'
import CompactOperatorAvatar from './CompactOperatorAvatar'
import SquadShareButton from './SquadShareButton'
import TextInputDialog from './TextInputDialog'
import { loadSavedGarrisons, saveSavedGarrisons } from './rendererPersistence'

type NameDialogMode = 'new' | 'save' | 'duplicate' | 'rename'
function GarrisonActionIcon({
  action,
}: {
  action: 'new' | 'duplicate' | 'rename' | 'delete' | 'generate' | 'clear'
}): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {action === 'new' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </>
      )}
      {action === 'duplicate' && (
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V4H4v12h4" />
        </>
      )}
      {action === 'rename' && (
        <>
          <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z" />
        </>
      )}
      {action === 'delete' && (
        <>
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
        </>
      )}
      {action === 'generate' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {action === 'clear' && (
        <>
          <path d="m16 3 5 5-11 13H5l-3-3L16 3Z" />
          <path d="m8 11 7 7M10 21h11" />
        </>
      )}
    </svg>
  )
}

type StageEditorState = {
  mode: 'new' | 'existing'
  stage: GarrisonStage
  undo: GarrisonStage | null
  redo: GarrisonStage | null
}

type ConflictPurpose = 'stage-confirm' | 'disable-cross-stage-duplicates'

const GARRISON_RECOVERY_KEY = 'arknights-randomizer:garrison-working-copy:v1'

interface GarrisonRecovery {
  working: Garrison
  baseline: Garrison
  selectedGarrisonId: string | null
  stageEditor: StageEditorState | null
  conflictDraft: Garrison | null
  conflictPurpose: ConflictPurpose | null
}

function loadGarrisonRecovery(): GarrisonRecovery | null {
  try {
    const saved = localStorage.getItem(GARRISON_RECOVERY_KEY)
    if (!saved) return null
    const recovery = JSON.parse(saved) as GarrisonRecovery
    return {
      ...recovery,
      working: cloneGarrison(recovery.working),
      baseline: cloneGarrison(recovery.baseline),
      conflictDraft: recovery.conflictDraft && cloneGarrison(recovery.conflictDraft),
    }
  } catch {
    return null
  }
}

function nextStageName(stages: readonly { name: string }[]): string {
  const used = new Set(stages.map((stage) => stage.name.trim().toLowerCase()))
  let index = stages.length + 1
  while (used.has(`stage ${index}`)) index += 1
  return `Stage ${index}`
}

function stageEquals(left: GarrisonStage, right: GarrisonStage): boolean {
  return JSON.stringify(cloneGarrisonStage(left)) === JSON.stringify(cloneGarrisonStage(right))
}

export default function GarrisonSquadFeature({
  operators,
  eligibleOperators,
  alterExclusivity,
  metadataRegion,
  gameLocale,
  onMessage,
  onDispatch,
}: {
  operators: readonly Operator[]
  eligibleOperators: readonly Operator[]
  alterExclusivity: boolean
  metadataRegion: ReleaseServer
  gameLocale: GameLocale
  onMessage: (message: string) => void
  onDispatch: (request: GarrisonDispatchRequest) => void
}): React.JSX.Element {
  const { confirmAction, showNotice, chooseSaveBeforeClose } = useAppDialogs()
  const [library, setLibrary] = useState<Garrison[]>(() => loadSavedGarrisons())
  const [recovery] = useState(() => (import.meta.env.PROD ? loadGarrisonRecovery() : null))
  const [working, setWorking] = useState<Garrison>(() => recovery?.working ?? createGarrison())
  const [baseline, setBaseline] = useState<Garrison>(
    () => recovery?.baseline ?? cloneGarrison(working),
  )
  const [selectedGarrisonId, setSelectedGarrisonId] = useState<string | null>(
    recovery?.selectedGarrisonId ?? null,
  )
  const [undoWorking, setUndoWorking] = useState<Garrison | null>(null)
  const [redoWorking, setRedoWorking] = useState<Garrison | null>(null)
  const [stageEditor, setStageEditor] = useState<StageEditorState | null>(
    recovery?.stageEditor ?? null,
  )
  const [squadMethod, setSquadMethod] = useState<StageEditorState | null>(null)
  const [events, setEvents] = useState<GarrisonEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [eventId, setEventId] = useState('')
  const [stageType, setStageType] = useState<GarrisonEventStageType>('standard')
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null)
  const [stageDropHint, setStageDropHint] = useState<{
    stageId: string
    placement: 'before' | 'after'
  } | null>(null)
  const [conflictDraft, setConflictDraft] = useState<Garrison | null>(
    recovery?.conflictDraft ?? null,
  )
  const [conflictPurpose, setConflictPurpose] = useState<ConflictPurpose | null>(
    recovery?.conflictPurpose ?? null,
  )
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
  const selectedEvent = events.find((event) => event.id === eventId)
  const eventOptions = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        name: event.name,
        representative: garrisonEventHelperOperator(event, operators, metadataRegion),
        group: event.group === 'main' ? 'Main Story' : 'Side Story',
      })),
    [events, operators, metadataRegion],
  )
  const availableStageTypes = selectedEvent ? availableGarrisonEventStageTypes(selectedEvent) : []
  // The selected type may not exist for the next event. Always use a valid option.
  const selectedStageType = availableStageTypes.includes(stageType)
    ? stageType
    : (availableStageTypes[0] ?? 'standard')
  const selectedEventStages = selectedEvent?.stages[selectedStageType] ?? []

  useEffect(() => {
    let active = true
    setEventsLoading(true)
    setEventsError(null)
    setEvents([])
    setEventId('')
    window.desktop.getGarrisonEvents(metadataRegion, gameLocale).then(
      (catalog) => {
        if (!active) return
        setEvents(catalog)
        setEventsError(null)
        setEventsLoading(false)
      },
      (error: unknown) => {
        if (!active) return
        setEventsError(error instanceof Error ? error.message : 'Event catalog unavailable.')
        setEventsLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [metadataRegion, gameLocale, operators])

  useLayoutEffect(() => {
    saveSavedGarrisons(library)
  }, [library])

  useLayoutEffect(() => {
    if (import.meta.env.DEV) return
    try {
      if (hasUnsavedChanges) {
        const copy: GarrisonRecovery = {
          working,
          baseline,
          selectedGarrisonId,
          stageEditor,
          conflictDraft,
          conflictPurpose,
        }
        localStorage.setItem(GARRISON_RECOVERY_KEY, JSON.stringify(copy))
      } else {
        localStorage.removeItem(GARRISON_RECOVERY_KEY)
      }
    } catch {
      onMessage('Could not store the Garrison working copy on this device.')
    }
  }, [
    hasUnsavedChanges,
    working,
    baseline,
    selectedGarrisonId,
    stageEditor,
    conflictDraft,
    conflictPurpose,
    onMessage,
  ])

  // Electron waits for an in-app decision before closing or requesting a save.
  useEffect(
    () =>
      window.desktop.onGarrisonCloseDecisionRequested(() => {
        void chooseSaveBeforeClose({
          title: 'Save your Garrison before closing the application?',
          message:
            'Save Garrison saves your working stages and operators. Discard Changes closes without saving.',
        }).then((choice) => window.desktop.completeGarrisonCloseDecision(choice))
      }),
    [chooseSaveBeforeClose],
  )

  useEffect(
    () =>
      window.desktop.onGarrisonCloseSaveFailed(() => {
        showNotice({
          title: 'Garrison could not be saved',
          message: 'Resolve unfinished edits or conflicts, then try again.',
        })
      }),
    [showNotice],
  )

  useEffect(() => {
    if (import.meta.env.DEV) window.desktop.setGarrisonCloseDirty(hasUnsavedChanges)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (import.meta.env.PROD) return
    return () => window.desktop.setGarrisonCloseDirty(false)
  }, [])

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
    setNameDialog({ mode: 'new', initialValue: '' })
  }

  const confirmDiscardIfNeeded = async (action: () => void): Promise<boolean> => {
    if (
      hasUnsavedChanges &&
      !(await confirmAction({
        title: 'Discard unsaved Garrison changes?',
        message: 'Your saved Garrisons will not be changed.',
      }))
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
    if (selectedGarrisonId === null && working.name === 'Untitled Garrison') {
      setNameDialog({ mode: 'save', initialValue: '' })
      return
    }
    persistGarrison(
      cloneGarrison({
        ...working,
        name: working.name.trim() || 'Untitled Garrison',
      }),
    )
  }

  // Persist synchronously before acknowledging Electron's close request.
  // Include an open stage editor's draft instead of silently losing it.
  useEffect(() => {
    if (import.meta.env.PROD) return
    return window.desktop.onGarrisonCloseSaveRequested(() => {
      if (conflictDraft) {
        onMessage('Resolve or cancel the Garrison conflict before saving and closing.')
        window.desktop.completeGarrisonCloseSave(false)
        return
      }
      try {
        const candidate = cloneGarrison(working)
        if (stageEditor) {
          const stage = cloneGarrisonStage({
            ...stageEditor.stage,
            name: stageEditor.stage.name.trim() || 'Untitled Stage',
          })
          candidate.stages =
            stageEditor.mode === 'new'
              ? [...candidate.stages, stage]
              : candidate.stages.map((entry) => (entry.id === stage.id ? stage : entry))
        }
        if (!candidate.duplicateOperatorsAllowed && garrisonHasOperatorConflicts(candidate)) {
          onMessage('Resolve duplicate assignments before saving and closing.')
          window.desktop.completeGarrisonCloseSave(false)
          return
        }
        const saved = cloneGarrison({
          ...candidate,
          name: candidate.name.trim() || 'Untitled Garrison',
        })
        const nextLibrary = library.some((item) => item.id === saved.id)
          ? library.map((item) => (item.id === saved.id ? saved : item))
          : [...library, saved]
        saveSavedGarrisons(nextLibrary)
        window.desktop.completeGarrisonCloseSave(true)
      } catch (error) {
        onMessage(
          error instanceof Error
            ? `Could not save Garrison: ${error.message}`
            : 'Could not save Garrison.',
        )
        window.desktop.completeGarrisonCloseSave(false)
      }
    })
  }, [working, library, stageEditor, conflictDraft, onMessage])

  const deleteSelectedGarrison = async (): Promise<void> => {
    if (!selectedGarrison || stageEditor || conflictDraft) return
    const extra = dirty ? ' Unsaved working changes will also be discarded.' : ''
    if (
      !(await confirmAction({
        title: `Delete Garrison “${selectedGarrison.name}”?`,
        message: `This removes the Garrison from your saved Garrisons.${extra}`,
      }))
    )
      return
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
    if (action.mode === 'new') {
      confirmDiscardIfNeeded(() => {
        const next = createGarrison(name)
        setWorking(next)
        setBaseline(cloneGarrison(next))
        setSelectedGarrisonId(null)
        setStageEditor(null)
        setConflictDraft(null)
        setConflictPurpose(null)
        resetHistory()
        setNameDialog(null)
        onMessage('Started a new Garrison.')
      })
      return
    }
    setNameDialog(null)
    if (action.mode === 'save') {
      persistGarrison(cloneGarrison({ ...working, name }))
      return
    }
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

  const addEvent = (): void => {
    if (stageEditor || conflictDraft || !selectedEvent) return
    const names = appendEventStages(working.stages, selectedEvent, selectedStageType)
    if (!names.length) {
      onMessage(
        `No new ${selectedStageType.toUpperCase()} stages to add for “${selectedEvent.name}”.`,
      )
      return
    }
    const next = cloneGarrison(working)
    next.stages.push(...names.map((name) => createGarrisonStage(name)))
    applyWorkingEdit(next)
    const skipped = selectedEventStages.length - names.length
    onMessage(
      `Added ${names.length} stage${names.length === 1 ? '' : 's'} from “${selectedEvent.name}”${skipped ? `; skipped ${skipped} already present` : ''}. Save Garrison to keep the change.`,
    )
  }

  const addStage = (): void => {
    if (stageEditor || conflictDraft) return
    setSquadMethod({
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

  const generateStage = (stage: GarrisonStage): void => {
    if (stageEditor || conflictDraft) return
    setSquadMethod({
      mode: 'existing',
      stage: cloneGarrisonStage(stage),
      undo: null,
      redo: null,
    })
  }

  const selectSquadMethod = (method: 'manual' | 'standard' | 'draft'): void => {
    if (!squadMethod) return
    const pending = squadMethod
    setSquadMethod(null)
    if (method === 'manual') {
      setStageEditor(pending)
      return
    }
    const excludedOperatorIds = garrisonDispatchExclusions(working, pending.stage.id)
    const eligibleIds = new Set(eligibleOperators.map((operator) => operator.id))
    onDispatch({
      mode: method,
      stageName: pending.stage.name.trim() || 'Untitled Stage',
      excludedOperatorIds,
      onConfirm: (operatorIds) => {
        const normalized = normalizeGarrisonStageOperatorIds(operatorIds)
        if (
          !normalized.length ||
          normalized.length !== operatorIds.length ||
          normalized.some((id) => !eligibleIds.has(id) || excludedOperatorIds.includes(id))
        ) {
          onMessage('This squad cannot be assigned to the Garrison stage. Generate a new squad.')
          return false
        }
        const committed = cloneGarrisonStage({ ...pending.stage, operatorIds: normalized })
        committed.name = committed.name.trim() || 'Untitled Stage'
        const next = cloneGarrison(working)
        next.stages =
          pending.mode === 'new'
            ? [...next.stages, committed]
            : next.stages.map((stage) => (stage.id === committed.id ? committed : stage))
        if (!next.duplicateOperatorsAllowed && garrisonHasOperatorConflicts(next)) return false
        applyWorkingEdit(next)
        onMessage(`Assigned squad to “${committed.name}”. Save Garrison to keep the change.`)
        return true
      },
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

  const moveStage = (
    movingStageId: string,
    targetStageId: string,
    placement: 'before' | 'after',
  ): void => {
    if (stageEditor || conflictDraft) return
    const next = reorderGarrisonStages(working, movingStageId, targetStageId, placement)
    if (garrisonEquals(working, next)) return
    applyWorkingEdit(next)
    onMessage('Reordered Garrison stages. Save Garrison to keep the new order.')
  }

  const stageDragStart = (event: DragEvent<HTMLButtonElement>, stageId: string): void => {
    if (stageEditor || conflictDraft) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', stageId)
    setDraggedStageId(stageId)
    setStageDropHint(null)
  }

  const stageDragOver = (event: DragEvent<HTMLDivElement>, stageId: string): void => {
    if (!draggedStageId || draggedStageId === stageId || stageEditor || conflictDraft) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const placement =
      event.clientY <
      event.currentTarget.getBoundingClientRect().top +
        event.currentTarget.getBoundingClientRect().height / 2
        ? 'before'
        : 'after'
    setStageDropHint((current) =>
      current?.stageId === stageId && current.placement === placement
        ? current
        : { stageId, placement },
    )
  }

  const stageDrop = (event: DragEvent<HTMLDivElement>, stageId: string): void => {
    event.preventDefault()
    const movingStageId = draggedStageId
    const placement =
      event.clientY <
      event.currentTarget.getBoundingClientRect().top +
        event.currentTarget.getBoundingClientRect().height / 2
        ? 'before'
        : 'after'
    setDraggedStageId(null)
    setStageDropHint(null)
    if (movingStageId) moveStage(movingStageId, stageId, placement)
  }

  const stageHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, stageId: string): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (stageEditor || conflictDraft) return
    event.preventDefault()
    const currentIndex = working.stages.findIndex((stage) => stage.id === stageId)
    const targetIndex = currentIndex + (event.key === 'ArrowUp' ? -1 : 1)
    const target = working.stages[targetIndex]
    if (target) moveStage(stageId, target.id, event.key === 'ArrowUp' ? 'before' : 'after')
  }

  const clearStageSquad = (stageId: string): void => {
    if (stageEditor || conflictDraft) return
    const stage = working.stages.find((entry) => entry.id === stageId)
    if (!stage?.operatorIds.length) return
    applyWorkingEdit(clearGarrisonStageSquad(working, stageId))
    onMessage(`Cleared operators from “${stage.name}”. Stage retained; use Undo Edit to restore.`)
  }

  const clearEverySquad = async (): Promise<void> => {
    if (stageEditor || conflictDraft || !working.stages.some((stage) => stage.operatorIds.length))
      return
    if (
      !(await confirmAction({
        title: 'Clear all operator assignments?',
        message: 'The stage table will be kept, and you can undo this edit.',
      }))
    )
      return
    applyWorkingEdit(clearAllGarrisonSquads(working))
    onMessage('Cleared all stage squads without removing any stages. Use Undo Edit to restore.')
  }

  const deleteStage = async (stageId: string): Promise<void> => {
    if (stageEditor || conflictDraft) return
    const stage = working.stages.find((candidate) => candidate.id === stageId)
    if (!stage) return
    if (
      stage.operatorIds.length > 0 &&
      !(await confirmAction({
        title: `Delete stage “${stage.name}”?`,
        message: `This removes the stage and its ${stage.operatorIds.length} operator assignment${stage.operatorIds.length === 1 ? '' : 's'}.`,
      }))
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

  const displayedStages =
    stageEditor?.mode === 'new' ? [...working.stages, stageEditor.stage] : working.stages

  return (
    <>
      <section className="panel squad-panel garrison-panel" aria-labelledby="garrison-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GET SQUAD • GARRISON</p>
            <h2 id="garrison-heading">Garrison</h2>
          </div>
        </div>

        <div className="preset-toolbar garrison-toolbar">
          <span className="preset-toolbar-label">Garrison</span>
          <label className="preset-select">
            <span className="sr-only">Saved Garrison</span>
            <select
              value={selectedGarrisonId ?? 'new'}
              disabled={stageEditor !== null || conflictDraft !== null}
              onChange={async (event) => {
                const select = event.currentTarget
                const id = select.value
                if (id === 'new') {
                  if (selectedGarrisonId === null) return
                  beginNewGarrison()
                  return
                }
                const garrison = library.find((candidate) => candidate.id === id)
                if (garrison && !(await confirmDiscardIfNeeded(() => loadGarrison(garrison)))) {
                  select.value = selectedGarrisonId ?? 'new'
                }
              }}
            >
              <option value="new">
                {selectedGarrisonId === null && working.name !== 'Untitled Garrison'
                  ? working.name
                  : 'New Garrison'}
              </option>
              {library.length > 0 && (
                <optgroup label="Saved">
                  {library.map((garrison) => (
                    <option key={garrison.id} value={garrison.id}>
                      {garrison.id === selectedGarrisonId ? working.name : garrison.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="preset-actions">
            <button
              type="button"
              className="secondary-button garrison-library-action"
              aria-label="New Garrison"
              title="New Garrison"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={beginNewGarrison}
            >
              <GarrisonActionIcon action="new" />
            </button>
            <button
              type="button"
              className="secondary-button garrison-library-action"
              aria-label="Duplicate Garrison"
              title="Duplicate Garrison"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={() =>
                setNameDialog({ mode: 'duplicate', initialValue: `${working.name} copy` })
              }
            >
              <GarrisonActionIcon action="duplicate" />
            </button>
            <button
              type="button"
              className="secondary-button garrison-library-action"
              aria-label="Rename Garrison"
              title="Rename Garrison"
              disabled={stageEditor !== null || conflictDraft !== null}
              onClick={() => setNameDialog({ mode: 'rename', initialValue: working.name })}
            >
              <GarrisonActionIcon action="rename" />
            </button>
            <button
              type="button"
              className="secondary-button garrison-library-action garrison-library-action--delete"
              aria-label="Delete Garrison"
              title="Delete Garrison"
              disabled={!selectedGarrison || stageEditor !== null || conflictDraft !== null}
              onClick={deleteSelectedGarrison}
            >
              <GarrisonActionIcon action="delete" />
            </button>
            <label className="garrison-repeat-toggle mode-checkbox">
              <input
                type="checkbox"
                checked={working.duplicateOperatorsAllowed}
                disabled={stageEditor !== null || conflictDraft !== null}
                onChange={(event) => changeDuplicatePolicy(event.target.checked)}
              />
              <span>Allow duplicates</span>
            </label>
            <span className="preset-actions-spacer" aria-hidden="true" />
            <div className="mode-primary-actions">
              <button
                type="button"
                className="randomize-button garrison-save-button"
                aria-label="Save Garrison"
                aria-describedby="garrison-save-status"
                disabled={
                  stageEditor !== null ||
                  conflictDraft !== null ||
                  (selectedGarrison !== null && !dirty)
                }
                onClick={saveGarrison}
              >
                <span>Save Garrison</span>
                <small id="garrison-save-status" role="status">
                  {stageEditor
                    ? 'Editing Stage'
                    : conflictDraft
                      ? 'Resolve Conflict'
                      : dirty
                        ? 'Unsaved Changes'
                        : selectedGarrison
                          ? 'Saved'
                          : 'New Garrison'}
                </small>
              </button>
              <SquadShareButton
                label="Share Garrison"
                result={
                  working.stages.length && !stageEditor && !conflictDraft
                    ? {
                        mode: 'Garrison',
                        generatedAt: new Date(),
                        members: [],
                        garrison: {
                          name: working.name,
                          duplicateOperatorsAllowed: working.duplicateOperatorsAllowed,
                          stages: working.stages.map((stage) => ({
                            name: stage.name,
                            members: stage.operatorIds.map(
                              (id) =>
                                operatorById.get(id) ?? { id, name: `Unknown operator (${id})` },
                            ),
                          })),
                        },
                      }
                    : null
                }
              />
            </div>
          </div>
        </div>

        <section
          className="current-constraint-summary garrison-participation-summary"
          aria-labelledby="garrison-participants-heading"
        >
          <div className="current-constraint-summary-content">
            <strong className="constraint-summary-heading" id="garrison-participants-heading">
              Participating Operators
            </strong>
            <div className="constraint-summary-chips">
              <span className="constraint-summary-chip">
                {working.stages.length} {working.stages.length === 1 ? 'stage' : 'stages'}
              </span>
              <span className="constraint-summary-chip">
                {participation.length} unique operators
              </span>
            </div>
            {participation.length === 0 ? (
              <p>No operators assigned yet.</p>
            ) : (
              <div
                className="garrison-participant-list"
                aria-label="Participating operators by stage count"
              >
                {participation.map(({ operatorId, stageCount }) => {
                  const operator = operatorById.get(operatorId)
                  const label = operator?.name ?? operatorId
                  return (
                    <span
                      className="garrison-participant-entry"
                      key={operatorId}
                      title={`${label} — ${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`}
                      style={{ position: 'relative', display: 'inline-flex' }}
                    >
                      {operator ? (
                        <CompactOperatorAvatar operator={operator} />
                      ) : (
                        <span
                          className="release-representative draft-history__operator-icon garrison-stage-missing-icon"
                          title={operatorId}
                        >
                          ?
                        </span>
                      )}
                      {stageCount >= 2 && (
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
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <div className="garrison-stage-quickadd" aria-label="Garrison stage tools">
          <div className="garrison-event-picker">
            <EventSelectorDropdown
              label="Event name"
              showLabel={false}
              options={eventOptions}
              value={eventId}
              groups={['Main Story', 'Side Story']}
              placeholder={
                eventsLoading
                  ? 'Loading events…'
                  : events.length
                    ? 'Quick add event'
                    : 'Events unavailable'
              }
              disabled={
                eventsLoading || !events.length || stageEditor !== null || conflictDraft !== null
              }
              onChange={(id) => {
                setEventId(id)
                return true
              }}
            />
          </div>
          <label className="garrison-type-selector">
            <span className="sr-only">Stage type</span>
            <select
              aria-label="Stage type"
              value={selectedStageType}
              disabled={
                availableStageTypes.length === 0 || stageEditor !== null || conflictDraft !== null
              }
              onChange={(event) => setStageType(event.target.value as GarrisonEventStageType)}
            >
              {availableStageTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'standard'
                    ? 'Standard Stage'
                    : type === 'h'
                      ? 'H Stage'
                      : type === 'ex'
                        ? 'EX Stage'
                        : 'S Stage'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!selectedEventStages.length || stageEditor !== null || conflictDraft !== null}
            onClick={addEvent}
            title={
              selectedEvent
                ? `Add ${selectedEventStages.length} ${selectedStageType.toUpperCase()} stages from ${selectedEvent.name}`
                : 'Select an event first'
            }
          >
            Add Event
          </button>
          <span className="garrison-stage-quickadd-spacer" aria-hidden="true" />
          <button
            type="button"
            className="secondary-button garrison-history-toggle"
            disabled={(!canUndo && !canRedo) || conflictDraft !== null}
            onClick={canUndo ? undoEdit : redoEdit}
          >
            {canUndo ? 'Undo Edit' : 'Redo Edit'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={
              stageEditor !== null ||
              conflictDraft !== null ||
              !working.stages.some((stage) => stage.operatorIds.length > 0)
            }
            onClick={clearEverySquad}
            title="Clear all operator assignments, preserving the stage table"
          >
            Clear all
          </button>
        </div>
        {eventsError && (
          <p className="garrison-event-error" role="status">
            {eventsError}
          </p>
        )}

        <div className="garrison-stage-table" role="table" aria-label="Garrison stages">
          <div className="garrison-stage-row garrison-stage-row--header" role="row">
            <span role="columnheader">Stage name</span>
            <span role="columnheader">Squad</span>
            <span role="columnheader">Actions</span>
          </div>
          {displayedStages.length === 0 ? (
            <div className="garrison-empty-stages">No stages yet. Add a stage to begin.</div>
          ) : (
            displayedStages.map((stage) => (
              <Fragment key={stage.id}>
                <div
                  className={[
                    'garrison-stage-row',
                    draggedStageId === stage.id ? 'is-dragging' : '',
                    stageDropHint?.stageId === stage.id ? `is-drop-${stageDropHint.placement}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="row"
                  onDragOver={(event) => stageDragOver(event, stage.id)}
                  onDrop={(event) => stageDrop(event, stage.id)}
                >
                  <div className="garrison-stage-name-cell" role="cell">
                    <button
                      type="button"
                      className="garrison-stage-drag-handle"
                      draggable={stageEditor === null && conflictDraft === null}
                      disabled={stageEditor !== null || conflictDraft !== null}
                      aria-label={`Reorder ${stage.name}; use Up or Down arrow keys`}
                      title="Drag to reorder; use Up/Down arrow keys when focused"
                      onDragStart={(event) => stageDragStart(event, stage.id)}
                      onDragEnd={() => {
                        setDraggedStageId(null)
                        setStageDropHint(null)
                      }}
                      onKeyDown={(event) => stageHandleKeyDown(event, stage.id)}
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                    <label className="garrison-stage-name">
                      <span className="sr-only">Stage name</span>
                      <input
                        type="text"
                        value={
                          stageEditor?.stage.id === stage.id ? stageEditor.stage.name : stage.name
                        }
                        disabled={
                          (stageEditor !== null && stageEditor.stage.id !== stage.id) ||
                          conflictDraft !== null
                        }
                        onChange={(event) =>
                          stageEditor?.stage.id === stage.id
                            ? changeStageEditor({ ...stageEditor.stage, name: event.target.value })
                            : renameStage(stage.id, event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="garrison-stage-squad-preview" role="cell">
                    {stageEditor?.stage.id === stage.id ? null : stage.operatorIds.length === 0 ? (
                      <span className="garrison-stage-squad-placeholder">Empty</span>
                    ) : (
                      <div
                        className="garrison-stage-squad-icons"
                        aria-label={`${stage.operatorIds.length} assigned operators`}
                      >
                        {stage.operatorIds.map((operatorId) => {
                          const operator = operatorById.get(operatorId)
                          return operator ? (
                            <CompactOperatorAvatar key={operatorId} operator={operator} />
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
                      className="secondary-button garrison-stage-icon-button"
                      aria-label={`Edit ${stage.name}`}
                      title="Edit"
                      disabled={stageEditor !== null || conflictDraft !== null}
                      onClick={() => editStage(stage)}
                    >
                      <GarrisonActionIcon action="rename" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button garrison-stage-icon-button"
                      aria-label={`Generate squad for ${stage.name}`}
                      title="Generate squad · Standard / Draft"
                      disabled={stageEditor !== null || conflictDraft !== null}
                      onClick={() => generateStage(stage)}
                    >
                      <GarrisonActionIcon action="generate" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button garrison-stage-icon-button"
                      aria-label={`Clear squad for ${stage.name}`}
                      disabled={
                        stageEditor !== null ||
                        conflictDraft !== null ||
                        stage.operatorIds.length === 0
                      }
                      onClick={() => clearStageSquad(stage.id)}
                      title={`Clear operators from ${stage.name} without deleting the stage`}
                    >
                      <GarrisonActionIcon action="clear" />
                    </button>
                    <button
                      type="button"
                      className="danger-button garrison-stage-icon-button"
                      aria-label={`Delete ${stage.name}`}
                      title="Delete stage"
                      disabled={stageEditor !== null || conflictDraft !== null}
                      onClick={() => deleteStage(stage.id)}
                    >
                      <GarrisonActionIcon action="delete" />
                    </button>
                  </div>
                </div>
                {stageEditor?.stage.id === stage.id && (
                  <div className="garrison-stage-editor-inline" role="row">
                    <GarrisonStageEditor
                      mode={stageEditor.mode}
                      stage={stageEditor.stage}
                      otherStages={working.stages.filter(
                        (entry) => entry.id !== stageEditor.stage.id,
                      )}
                      duplicateOperatorsAllowed={working.duplicateOperatorsAllowed}
                      alterExclusivity={alterExclusivity}
                      operators={operators}
                      eligibleOperators={eligibleOperators}
                      onChange={changeStageEditor}
                      onCancel={cancelStageEditor}
                      onConfirm={confirmStageEditor}
                    />
                  </div>
                )}
              </Fragment>
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
      </section>

      {squadMethod && (
        <GarrisonSquadMethodDialog
          stage={squadMethod.stage}
          includeManual={squadMethod.mode === 'new'}
          onNameChange={(name) =>
            setSquadMethod({ ...squadMethod, stage: { ...squadMethod.stage, name } })
          }
          onSelect={selectSquadMethod}
          onCancel={() => setSquadMethod(null)}
        />
      )}

      {nameDialog && (
        <TextInputDialog
          title={
            nameDialog.mode === 'new'
              ? 'New Garrison'
              : nameDialog.mode === 'save'
                ? 'Save Garrison'
                : nameDialog.mode === 'duplicate'
                  ? 'Duplicate Garrison'
                  : 'Rename Garrison'
          }
          initialValue={nameDialog.initialValue}
          inputLabel="Garrison Name"
          showInputLabel
          confirmLabel={
            nameDialog.mode === 'new'
              ? 'Create'
              : nameDialog.mode === 'save'
                ? 'Save'
                : nameDialog.mode === 'duplicate'
                  ? 'Duplicate'
                  : 'Rename'
          }
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
          onApply={(resolved) => {
            const purpose = conflictPurpose
            const mode = stageEditor?.mode ?? 'existing'
            const stageName = stageEditor?.stage.name.trim() || 'Untitled Stage'
            setConflictDraft(null)
            setConflictPurpose(null)
            if (purpose === 'disable-cross-stage-duplicates') {
              const stillConflicted = garrisonHasOperatorConflicts(resolved)
              applyWorkingEdit({ ...resolved, duplicateOperatorsAllowed: stillConflicted })
              onMessage(
                stillConflicted
                  ? 'Changes applied; duplicates remain allowed because conflicts still exist. Save Garrison to keep the change.'
                  : 'Conflicts resolved and cross-stage duplicate prevention enabled. Save Garrison to keep the change.',
              )
              return
            }
            setStageEditor(null)
            const stillConflicted = garrisonHasOperatorConflicts(resolved)
            applyWorkingEdit({
              ...resolved,
              duplicateOperatorsAllowed: stillConflicted || working.duplicateOperatorsAllowed,
            })
            onMessage(
              `${stillConflicted ? 'Unresolved conflicts accepted' : 'Conflicts cleared'} and ${mode === 'new' ? 'added' : 'updated'} stage “${stageName}” in the working Garrison. Save Garrison to keep the change.`,
            )
          }}
        />
      )}
    </>
  )
}
