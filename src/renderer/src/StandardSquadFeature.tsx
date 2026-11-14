import { useEffect, useMemo, useRef, useState } from 'react'
import SquadValidationBox from './SquadValidationBox'
import BoundPill from './BoundPill'
import ClassIcon from './ClassIcon'
import LockedSlotCard, { lockedSlotPresentation } from './LockedSlotCard'
import OperatorCard from './OperatorCard'
import RandomOperatorCard from './RandomOperatorCard'
import SquadConstraintEditor from './SquadConstraintEditor'
import SlotClassConstraintIndicator from './SlotClassConstraintIndicator'
import TextInputDialog from './TextInputDialog'
import { comparePoolGroups, comparePoolOperators, groupLabel } from './PoolPanelPresentation'
import PoolSortControls from './PoolSortControls'
import { useImportedArknightsAccount } from './arknightsAccountState'
import CompactOperatorAvatar from './CompactOperatorAvatar'
import SquadShareButton from './SquadShareButton'
import useOverflowScroll from './useOverflowScroll'
import { checkStandardRerolls } from './standardRerollChecks'
import { useStandardSquadCheck, useStandardSquadWorker, type StandardSquadRequest } from './useStandardSquadWorker'
import {
  cloneSlotConstraint,
  createEmptySlotConstraint,
  createEmptySlotConstraints,
  numericConstraintIsDefault,
  rarityGroupDefinitions,
  rarityGroupKeys,
  resolveNumericConstraint,
  slotConstraintIsEmpty,
  type NumericConstraint,
  type RandomizerConstraints,
  type RarityGroupKey,
  type SlotConstraint,
} from '../../shared/constraints'
import {
  BUILT_IN_SQUAD_PRESETS,
  applySquadConfiguration,
  cloneSquadConfiguration,
  createNoConstraintConfiguration,
  createUserPreset,
  squadConfigurationEquals,
  squadConfigurationFromConstraints,
  type SquadPreset,
  type StoredSquadPreset,
} from '../../shared/presets'
import {
  operatorClasses,
  operatorRarities,
  type Operator,
  type OperatorClass,
  type OperatorDataset,
  type OperatorRarity,
} from '../../shared/operator'
import {
  filterEligibleOperators,
  generateSquad,
  rollSquadReroll,
  validateConstraints,
  type ConstraintValidationResult,
} from '../../shared/randomizer'
import {
  dismissWarning,
  loadUserSquadPresets,
  saveUserSquadPresets,
  warningIsDismissed,
} from './rendererPersistence'

const slots = Array.from({ length: 12 }, (_, index) => index + 1)
const BOUND_WARNING_KEY = 'arknights-randomizer:dismiss-bound-reset-warning'
const PRESET_WARNING_KEY = 'arknights-randomizer:dismiss-preset-replace-warning'

interface ChainSession {
  pool: Operator[]
  constraints: RandomizerConstraints
  exhausted: Operator[]
}

interface PendingConfirmation {
  title: string
  body: string
  confirmLabel: string
  preferenceKey?: string
  apply: () => void
}

function numericSummary(label: string, constraint: NumericConstraint | undefined): string | null {
  const resolved = resolveNumericConstraint(constraint)
  if (numericConstraintIsDefault(resolved)) return null
  if (resolved.min === resolved.max) return `Exactly ${resolved.min} ${label}`
  if (resolved.min > 0 && resolved.max === 12) return `At least ${resolved.min} ${label}`
  if (resolved.min === 0 && resolved.max < 12) return `At most ${resolved.max} ${label}`
  return `${resolved.min}–${resolved.max} ${label}`
}

function BatchRerollWarning({ reason }: { reason: string }): React.JSX.Element {
  const { viewportRef, textRef } = useOverflowScroll<HTMLSpanElement>(reason)

  return (
    <>
      <span
        className="draft-operator-price draft-operator-price--cost"
        role="img"
        aria-label="Batch reroll blocked"
      >
        <span className="standard-squad-reroll-warning" aria-hidden="true">
          !
        </span>
      </span>
      <span className="standard-squad-reroll-reason" title={reason}>
        <span className="standard-squad-reroll-reason-viewport" ref={viewportRef}>
          <span className="standard-squad-reroll-reason-text" ref={textRef}>
            {reason}
          </span>
        </span>
      </span>
    </>
  )
}

function ConfirmationDialog({
  confirmation,
  dontShowAgain,
  setDontShowAgain,
  onCancel,
  onConfirm,
}: {
  confirmation: PendingConfirmation
  dontShowAgain: boolean
  setDontShowAgain: (value: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <div className="confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="confirmation-title">{confirmation.title}</h3>
        <p>{confirmation.body}</p>
        {confirmation.preferenceKey && (
          <label className="confirmation-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>Don&apos;t show this warning again</span>
          </label>
        )}
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="randomize-button" onClick={onConfirm}>
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StandardSquadFeature({
  dataset,
  constraints,
  finalOperatorPool,
  resetRevision,
  onConstraintsChange,
  onMessage,
  onError,
}: {
  dataset: OperatorDataset | null
  constraints: RandomizerConstraints
  finalOperatorPool: Operator[]
  resetRevision: number
  onConstraintsChange: (update: (current: RandomizerConstraints) => RandomizerConstraints) => void
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}): React.JSX.Element {
  const [squad, setSquad] = useState<Operator[]>([])
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [keptSlots, setKeptSlots] = useState<number[]>([])
  const [chainMode, setChainMode] = useState(false)
  const [chainPoolOpen, setChainPoolOpen] = useState(false)
  const [chainPoolView, setChainPoolView] = useState<'available' | 'exhausted'>('available')
  const [chainPoolSort, setChainPoolSort] = useState('default')
  const [chainPoolGroup, setChainPoolGroup] = useState('rarity')
  const importedAccount = useImportedArknightsAccount()
  const [chain, setChain] = useState<ChainSession | null>(null)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [userPresets, setUserPresets] = useState<StoredSquadPreset[]>(() => loadUserSquadPresets())
  const [selectedPresetId, setSelectedPresetId] = useState('builtin:none')
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [presetNameDialog, setPresetNameDialog] = useState<{
    mode: 'save' | 'duplicate' | 'rename'
    initialValue: string
  } | null>(null)
  const lastResetRevision = useRef(resetRevision)
  const runWorker = useStandardSquadWorker()
  const [rolling, setRolling] = useState(false)
  const activeRoll = useRef<(() => void) | null>(null)
  useEffect(() => () => {
    if (!activeRoll.current) return
    activeRoll.current()
    activeRoll.current = null
    setRolling(false)
  }, [constraints, finalOperatorPool, resetRevision])
  const chainValidationRequest = useMemo<StandardSquadRequest | null>(
    () => chainMode && !chain && dataset ? { type: 'validate', constraints, pool: finalOperatorPool } : null,
    [chainMode, chain, dataset, constraints, finalOperatorPool],
  )
  const chainValidation = useStandardSquadCheck<ConstraintValidationResult>(chainValidationRequest, runWorker)

  useEffect(() => {
    saveUserSquadPresets(userPresets)
  }, [userPresets])
  useEffect(() => {
    if (!dataset || chain) return
    const byId = new Map(dataset.operators.map((operator) => [operator.id, operator]))
    setSquad((current) => current.map((operator) => byId.get(operator.id) ?? operator))
  }, [chain, dataset])
  useEffect(() => {
    if (lastResetRevision.current === resetRevision) return
    lastResetRevision.current = resetRevision
    if (chain) return
    setSquad([])
    setKeptSlots([])
    setEditingSlot(null)
  }, [chain, resetRevision])

  const validation = useMemo(
    () => {
      if (chain) return { valid: true, errors: [] }
      if (chainMode) return chainValidation?.result ?? { valid: false, errors: chainValidation?.error ? [chainValidation.error] : [] }
      return dataset
        ? validateConstraints(constraints, finalOperatorPool)
        : { valid: false, errors: [] }
    },
    [chain, chainMode, chainValidation, constraints, dataset, finalOperatorPool],
  )
  const currentSquadConfiguration = useMemo(
    () => squadConfigurationFromConstraints(constraints),
    [constraints],
  )
  const allPresets = useMemo<SquadPreset[]>(
    () => [...BUILT_IN_SQUAD_PRESETS, ...userPresets],
    [userPresets],
  )
  const selectedPreset = useMemo(
    () => allPresets.find((preset) => preset.id === selectedPresetId),
    [allPresets, selectedPresetId],
  )
  const presetIsDirty = useMemo(
    () =>
      !selectedPreset ||
      !squadConfigurationEquals(currentSquadConfiguration, selectedPreset.configuration),
    [currentSquadConfiguration, selectedPreset],
  )
  const resetConfiguration = useMemo(
    () =>
      selectedPreset
        ? cloneSquadConfiguration(selectedPreset.configuration)
        : createNoConstraintConfiguration(constraints.squadSize),
    [constraints.squadSize, selectedPreset],
  )
  const canResetConstraints =
    squad.length === 0 && !squadConfigurationEquals(currentSquadConfiguration, resetConfiguration)

  const requestConfirmation = (
    preferenceKey: string,
    title: string,
    body: string,
    confirmLabel: string,
    apply: () => void,
  ): void => {
    if (warningIsDismissed(preferenceKey)) {
      apply()
      return
    }
    setDontShowAgain(false)
    setPendingConfirmation({ title, body, confirmLabel, preferenceKey, apply })
  }
  const confirmPending = (): void => {
    if (!pendingConfirmation) return
    const action = pendingConfirmation.apply
    if (dontShowAgain && pendingConfirmation.preferenceKey) {
      dismissWarning(pendingConfirmation.preferenceKey)
    }
    setPendingConfirmation(null)
    setDontShowAgain(false)
    action()
  }
  const markCustom = (): void => {
    if (!selectedPreset) setSelectedPresetId('custom')
  }
  const changeSquadSize = (squadSize: number): void => {
    if (squad.length > 0) return
    onConstraintsChange((current) => ({
      ...current,
      squadSize,
      slots: current.slots.map((slot, index) =>
        index < squadSize ? cloneSlotConstraint(slot) : createEmptySlotConstraint(),
      ),
    }))
    setEditingSlot((current) => (current !== null && current >= squadSize ? null : current))
    markCustom()
    onError(null)
  }
  const saveSlotConstraint = (slotIndex: number, value: SlotConstraint): void => {
    onConstraintsChange((current) => {
      const nextSlots = current.slots.map(cloneSlotConstraint)
      nextSlots[slotIndex] = cloneSlotConstraint(value)
      return { ...current, slots: nextSlots }
    })
    setEditingSlot(null)
    markCustom()
    onError(null)
  }
  const resetSlotConstraint = (slotIndex: number): void => {
    onConstraintsChange((current) => {
      const nextSlots = current.slots.map(cloneSlotConstraint)
      nextSlots[slotIndex] = createEmptySlotConstraint()
      return { ...current, slots: nextSlots }
    })
    setEditingSlot((current) => (current === slotIndex ? null : current))
    markCustom()
    onError(null)
    onMessage(`Squad slot ${slotIndex + 1} constraint reset.`)
  }

  const currentConstraintSummary = useMemo(() => {
    const items: string[] = []
    for (const rarity of [...operatorRarities].reverse()) {
      const summary = numericSummary(`${rarity}★`, constraints.rarity[rarity])
      if (summary) items.push(summary)
    }
    for (const group of rarityGroupKeys) {
      const summary = numericSummary(
        rarityGroupDefinitions[group].label,
        constraints.rarityGroups[group],
      )
      if (summary) items.push(summary)
    }
    for (const operatorClass of operatorClasses) {
      const summary = numericSummary(
        dataset?.classLabels?.[operatorClass] ?? operatorClass,
        constraints.class[operatorClass],
      )
      if (summary) items.push(summary)
    }
    return items
  }, [constraints.class, constraints.rarity, constraints.rarityGroups, dataset])

  const resetConstraints = (): void => {
    if (!canResetConstraints) return
    onConstraintsChange((current) => applySquadConfiguration(current, resetConfiguration))
    if (chain) {
      setSquad([])
      setKeptSlots([])
      setChain(null)
    }
    setEditingSlot(null)
    if (!selectedPreset) setSelectedPresetId('custom')
    onError(null)
    onMessage(
      selectedPreset
        ? `Constraints reset to preset “${selectedPreset.name}”.`
        : 'Custom constraints reset to a blank slate. Global Pool filters were preserved.',
    )
  }
  const clearSquad = (): void => {
    setSquad([])
    setKeptSlots([])
    setChain(null)
    onError(null)
    onMessage('Squad cleared. Slot constraints are ready to edit.')
  }
  const applyBoundChange = (
    label: string,
    update: (current: RandomizerConstraints) => RandomizerConstraints,
  ): void =>
    requestConfirmation(
      BOUND_WARNING_KEY,
      'Apply boundary change?',
      `Changing the ${label} squad bound will reset every slot constraint to Any / Any and clear the generated squad.`,
      'Apply & Reset',
      () => {
        onConstraintsChange((current) => ({
          ...update(current),
          slots: createEmptySlotConstraints(),
        }))
        setSquad([])
        setKeptSlots([])
        setChain(null)
        setEditingSlot(null)
        markCustom()
        onError(null)
        onMessage(`${label} bound saved. Slot constraints were reset.`)
      },
    )
  const saveRarityBound = (rarity: OperatorRarity, next: NumericConstraint): void => {
    const current = resolveNumericConstraint(constraints.rarity[rarity])
    if (current.min === next.min && current.max === next.max) return
    applyBoundChange(`${rarity}★`, (state) => {
      const rarityBounds = { ...state.rarity }
      if (numericConstraintIsDefault(next)) delete rarityBounds[rarity]
      else rarityBounds[rarity] = { ...next }
      return { ...state, rarity: rarityBounds }
    })
  }
  const saveRarityGroupBound = (group: RarityGroupKey, next: NumericConstraint): void => {
    const current = resolveNumericConstraint(constraints.rarityGroups[group])
    if (current.min === next.min && current.max === next.max) return
    applyBoundChange(rarityGroupDefinitions[group].label, (state) => {
      const rarityGroups = { ...state.rarityGroups }
      if (numericConstraintIsDefault(next)) delete rarityGroups[group]
      else rarityGroups[group] = { ...next }
      return { ...state, rarityGroups }
    })
  }
  const saveClassBound = (operatorClass: OperatorClass, next: NumericConstraint): void => {
    const current = resolveNumericConstraint(constraints.class[operatorClass])
    if (current.min === next.min && current.max === next.max) return
    applyBoundChange(operatorClass, (state) => {
      const classBounds = { ...state.class }
      if (numericConstraintIsDefault(next)) delete classBounds[operatorClass]
      else classBounds[operatorClass] = { ...next }
      return { ...state, class: classBounds }
    })
  }
  const applyPreset = (preset: SquadPreset): void => {
    const apply = (): void => {
      onConstraintsChange((current) => applySquadConfiguration(current, preset.configuration))
      setSquad([])
      setKeptSlots([])
      setChain(null)
      setEditingSlot(null)
      setSelectedPresetId(preset.id)
      onError(null)
      onMessage(`Applied squad preset “${preset.name}”.`)
    }
    if (squadConfigurationEquals(currentSquadConfiguration, preset.configuration)) {
      setSelectedPresetId(preset.id)
      return
    }
    if (
      !squadConfigurationEquals(currentSquadConfiguration, BUILT_IN_SQUAD_PRESETS[0].configuration)
    ) {
      requestConfirmation(
        PRESET_WARNING_KEY,
        `Apply “${preset.name}”?`,
        'This will replace the current squad size, composition bounds, and per-slot constraints. Operator eligibility filters will be preserved.',
        'Apply Preset',
        apply,
      )
    } else apply()
  }
  const saveAsPreset = (): void => {
    setPresetNameDialog({ mode: 'save', initialValue: '' })
  }
  const updateSelectedPreset = (): void => {
    if (!selectedPreset || selectedPreset.builtIn) return
    setUserPresets((current) =>
      current.map((preset) =>
        preset.id === selectedPreset.id
          ? { ...preset, configuration: cloneSquadConfiguration(currentSquadConfiguration) }
          : preset,
      ),
    )
    onMessage(`Updated squad preset “${selectedPreset.name}”.`)
  }
  const renameSelectedPreset = (): void => {
    if (!selectedPreset || selectedPreset.builtIn) return
    setPresetNameDialog({ mode: 'rename', initialValue: selectedPreset.name })
  }
  const duplicateSelectedPreset = (): void => {
    if (!selectedPreset) return
    setPresetNameDialog({ mode: 'duplicate', initialValue: `${selectedPreset.name} copy` })
  }
  const confirmPresetName = (name: string): void => {
    const action = presetNameDialog
    if (!action) return
    setPresetNameDialog(null)
    if (action.mode === 'rename') {
      if (!selectedPreset || selectedPreset.builtIn) return
      setUserPresets((current) =>
        current.map((preset) => (preset.id === selectedPreset.id ? { ...preset, name } : preset)),
      )
      onMessage(`Renamed squad preset to “${name}”.`)
      return
    }
    const preset = createUserPreset(name, currentSquadConfiguration)
    setUserPresets((current) => [...current, preset])
    setSelectedPresetId(preset.id)
    onMessage(
      action.mode === 'duplicate'
        ? `Duplicated squad preset as “${preset.name}”.`
        : `Saved squad preset “${preset.name}”.`,
    )
  }
  const deleteSelectedPreset = (): void => {
    if (
      !selectedPreset ||
      selectedPreset.builtIn ||
      !window.confirm(`Delete squad preset “${selectedPreset.name}”?`)
    )
      return
    setUserPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id))
    setSelectedPresetId('custom')
    onMessage(`Deleted squad preset “${selectedPreset.name}”.`)
  }
  const rerollInput = useMemo(() => {
    const current = chain
      ? applySquadConfiguration(chain.constraints, currentSquadConfiguration)
      : constraints
    if (!dataset || squad.length !== current.squadSize) return null
    return { current, squad, pool: chain?.pool ?? finalOperatorPool, exhausted: chain?.exhausted ?? [], keptSlots, chainMode: Boolean(chain) }
  }, [chain, constraints, currentSquadConfiguration, dataset, finalOperatorPool, keptSlots, squad])
  const rerollRequest = useMemo<StandardSquadRequest | null>(
    () => rerollInput?.chainMode ? { type: 'check', input: rerollInput } : null,
    [rerollInput],
  )
  const chainRerolls = useStandardSquadCheck<ReturnType<typeof checkStandardRerolls>>(rerollRequest, runWorker)
  const rerolls = useMemo(
    () => rerollRequest ? chainRerolls?.result : rerollInput ? checkStandardRerolls(rerollInput) : null,
    [rerollRequest, chainRerolls, rerollInput],
  )
  const checkingRerolls = Boolean(rerollRequest && !chainRerolls)
  const checkingInitial = Boolean(chainValidationRequest && !chainValidation)
  const useBatchReroll = Boolean(chain) || keptSlots.length > 0
  const keepableSlots = squad.flatMap((_, index) =>
    index < constraints.squadSize && !constraints.slots[index]?.operatorId ? [index] : [],
  )
  const allKept = keepableSlots.length > 0 && keepableSlots.every((index) => keptSlots.includes(index))
  const rerollableCount = keepableSlots.filter((index) => !keptSlots.includes(index)).length
  const batchRerollLabel =
    rerollableCount === squad.length
      ? 'Reroll All'
      : `Reroll ${rerollableCount} ${rerollableCount === 1 ? 'Slot' : 'Slots'}`
  const chainInitialPool = chainMode && !chain
    ? filterEligibleOperators(finalOperatorPool, constraints)
    : []
  const availableChainOperators = useMemo(() => {
    if (!chain) return chainInitialPool
    const used = new Set([...squad, ...chain.exhausted].map(({ id }) => id))
    return chain.pool.filter(({ id }) => !used.has(id))
  }, [chain, chainInitialPool, squad])
  const chainPoolSize = chain?.pool.length ?? chainInitialPool.length
  const showingExhausted = chainPoolView === 'exhausted'
  const displayedChainOperators = showingExhausted ? (chain?.exhausted ?? []) : availableChainOperators
  const chainOperatorGroups = useMemo(() => {
    if (!dataset || !chainPoolOpen) return []
    const poolConstraints = chain?.constraints ?? constraints
    const groups = new Map<string, Operator[]>()
    for (const operator of displayedChainOperators) {
      const label = groupLabel(operator, chainPoolGroup, dataset, poolConstraints, importedAccount)
      const members = groups.get(label)
      if (members) members.push(operator)
      else groups.set(label, [operator])
    }
    const entries = [...groups]
    for (const [, members] of entries) {
      members.sort((left, right) => comparePoolOperators(left, right, chainPoolSort, poolConstraints))
    }
    const direction = chainPoolGroup === 'rarity' ? 'desc' : 'asc'
    return entries.sort((left, right) =>
      comparePoolGroups(left, right, chainPoolGroup, poolConstraints, direction),
    )
  }, [dataset, chainPoolOpen, chain, constraints, displayedChainOperators, chainPoolGroup, chainPoolSort, importedAccount])

  const toggleChainMode = (enabled: boolean): void => {
    const apply = (): void => {
      setChainMode(enabled)
      setChain(null)
      setSquad([])
      setKeptSlots([])
      onError(null)
    }
    if (squad.length === 0) {
      apply()
      return
    }
    setDontShowAgain(false)
    setPendingConfirmation({
      title: enabled ? 'Enable Chain Mode?' : 'Disable Chain Mode?',
      body: 'Changing Chain Mode clears the current squad and any exhausted operators.',
      confirmLabel: enabled ? 'Enable & Clear' : 'Disable & Clear',
      apply,
    })
  }

  const rerollSquad = (slotIndex?: number): void => {
    if (!rerolls || activeRoll.current) return
    const plan = slotIndex === undefined ? rerolls.batch : rerolls.bySlot[slotIndex]
    if (!plan) return
    const targets = slotIndex === undefined ? rerolls.rerollableSlots : [slotIndex]
    onError(null)
    const apply = (next: Operator[]): void => {
      setSquad(next)
      setGeneratedAt(new Date())
      if (chain) {
        const outgoing = targets.map((index) => squad[index])
        setChain({ ...chain, exhausted: [...chain.exhausted, ...outgoing] })
      }
      onMessage(
        targets.length === 1
          ? `Rerolled slot ${targets[0] + 1}.`
          : `Rerolled ${targets.length} slots.`,
      )
    }
    if (chain) {
      startChainRoll({ type: 'reroll', plan }, apply)
      return
    }
    try {
      apply(rollSquadReroll(plan))
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const randomize = (): void => {
    if (!dataset || activeRoll.current) return
    onError(null)
    if (!validation.valid) {
      onError(validation.errors.join(' '))
      return
    }
    const apply = (next: Operator[]): void => {
      setSquad(next)
      setGeneratedAt(new Date())
      if (chainMode) setChain({ pool: chainInitialPool, constraints, exhausted: [] })
      onMessage(`Generated a squad of ${constraints.squadSize} operators.`)
    }
    if (chainMode) {
      startChainRoll({ type: 'initial', pool: finalOperatorPool, constraints }, apply)
      return
    }
    try {
      apply(generateSquad(finalOperatorPool, constraints))
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  function startChainRoll(request: StandardSquadRequest, apply: (next: Operator[]) => void): void {
    setRolling(true)
    activeRoll.current = runWorker(
      request,
      (result) => {
        activeRoll.current = null
        setRolling(false)
        apply(result as Operator[])
      },
      (error) => {
        activeRoll.current = null
        setRolling(false)
        onError(error)
      },
    )
  }

  return (
    <>
      <section className="panel squad-panel" aria-labelledby="squad-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GET SQUAD • STANDARD</p>
            <h2 id="squad-heading">Standard squad</h2>
          </div>
        </div>

        <div className="preset-toolbar" aria-busy={rolling || checkingInitial || checkingRerolls}>
          <span className="preset-toolbar-label">Preset</span>
          <label className="preset-select">
            <span className="sr-only">Squad preset</span>
            <select
              disabled={rolling}
              value={presetIsDirty ? 'custom' : selectedPresetId}
              onChange={(event) => {
                const id = event.target.value
                if (id === 'custom') {
                  setSelectedPresetId('custom')
                  return
                }
                const preset = allPresets.find((candidate) => candidate.id === id)
                if (preset) applyPreset(preset)
              }}
            >
              <option value="custom">Custom</option>
              <optgroup label="Built-in">
                {BUILT_IN_SQUAD_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              {userPresets.length > 0 && (
                <optgroup label="Saved">
                  {userPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="preset-actions">
            <button type="button" className="secondary-button" onClick={saveAsPreset}>
              Save as preset…
            </button>
            {selectedPreset && (
              <button type="button" className="secondary-button" onClick={duplicateSelectedPreset}>
                Duplicate
              </button>
            )}
            <label className="confirmation-checkbox">
              <input
                type="checkbox"
                checked={chainMode}
                disabled={rolling}
                onChange={(event) => toggleChainMode(event.target.checked)}
              />
              <span>Chain Mode</span>
            </label>
            {selectedPreset && !selectedPreset.builtIn && (
              <>
                <button type="button" className="secondary-button" onClick={updateSelectedPreset}>
                  Update
                </button>
                <button type="button" className="secondary-button" onClick={renameSelectedPreset}>
                  Rename
                </button>
                <button type="button" className="secondary-button" onClick={deleteSelectedPreset}>
                  Delete
                </button>
              </>
            )}
            <span className="preset-actions-spacer" aria-hidden="true" />
            <button
              className="danger-button"
              type="button"
              disabled={rolling || squad.length === 0}
              onClick={clearSquad}
            >
              Clear
            </button>
            {squad.length > 0 && (
              <button
                className="secondary-button"
                type="button"
                disabled={rolling || keepableSlots.length === 0}
                onClick={() => setKeptSlots(allKept ? [] : keepableSlots)}
              >
                {allKept ? 'Unkeep All' : 'Keep All'}
              </button>
            )}
            {generatedAt && squad.length === constraints.squadSize && (
              <SquadShareButton result={{ mode: 'Standard Mode', generatedAt, members: squad }} />
            )}
            {(!chain || rerollableCount > 0) && (
              <button
                className="randomize-button"
                type="button"
                disabled={rolling || (useBatchReroll ? !rerolls?.batch : !dataset || !validation.valid)}
                title={
                  checkingRerolls || checkingInitial
                    ? 'Checking squad…'
                    : useBatchReroll && !rerolls?.batch
                    ? 'No eligible replacements for the remaining slots'
                    : undefined
                }
                onClick={useBatchReroll ? () => rerollSquad() : randomize}
              >
                {rolling ? 'Rolling…' : checkingRerolls || checkingInitial ? 'Checking…' : useBatchReroll ? batchRerollLabel : 'Randomize'}
              </button>
            )}
          </div>
        </div>

        <div className="current-constraint-summary" aria-label="Current squad constraints">
          <div className="current-constraint-summary-content">
            <strong>Current constraints</strong>
            {currentConstraintSummary.length > 0 ? (
              <div>
                {currentConstraintSummary.map((summary) => (
                  <span key={summary}>{summary}</span>
                ))}
              </div>
            ) : (
              <p>No active squad-wide constraints.</p>
            )}
          </div>
          <button
            className="danger-button"
            type="button"
            disabled={!canResetConstraints}
            onClick={resetConstraints}
          >
            Reset
          </button>
        </div>
        {dataset && !validation.valid && validation.errors.length > 0 && (
          <SquadValidationBox errors={validation.errors} />
        )}
        {chainRerolls?.error && <SquadValidationBox errors={[chainRerolls.error]} />}

        <div className="squad-grid">
          {slots.map((slot, index) => {
            const operator = squad[index]
            const inRange = index < constraints.squadSize
            const slotConstraint = constraints.slots[index] ?? createEmptySlotConstraint()
            const locked = Boolean(slotConstraint.operatorId)
            const kept = keptSlots.includes(index)
            const canReroll = Boolean(rerolls?.bySlot[index])
            const batchWarning = rerolls?.batchWarnings.get(index)
            const singleWarning = rerolls?.singleWarnings.get(index)
            const singleWarningId = `single-reroll-reason-${slot}`
            const constrained = !slotConstraintIsEmpty(slotConstraint)
            const indicatorOperators = dataset?.operators ?? finalOperatorPool
            const lockedPresentation =
              !operator &&
              inRange &&
              constrained &&
              (slotConstraint.operatorId || slotConstraint.mandatoryExclusivityGroup)
                ? lockedSlotPresentation(slotConstraint, finalOperatorPool)
                : null
            return (
              <div className={`squad-slot${!inRange ? ' squad-slot--disabled' : ''}`} key={slot}>
                {!inRange ? (
                  <div className="disabled-slot" aria-label={`Squad slot ${slot} unavailable`}>
                    <span className="slot-config-number" aria-hidden="true">
                      /
                    </span>
                    <span>Unavailable</span>
                    <small>Squad size {constraints.squadSize}</small>
                  </div>
                ) : operator ? (
                  <OperatorCard
                    operator={operator}
                    replayOnRandomize={!kept && !(locked && useBatchReroll)}
                    topRightAdornment={
                      locked || kept ? (
                        <span className="draft-operator-price draft-operator-price--neutral">
                          <img
                            className="standard-squad-padlock"
                            src={new URL('./assets/draft/locked-slot-icon.png', import.meta.url).href}
                            alt={locked ? 'Locked by slot constraint' : 'Kept'}
                          />
                        </span>
                      ) : batchWarning ? (
                        <BatchRerollWarning reason={batchWarning} />
                      ) : undefined
                    }
                    overlay={
                      <div className="draft-operator-actions">
                        {singleWarning && (
                          <span className="standard-squad-single-reroll-reason" id={singleWarningId}>
                            {singleWarning}
                          </span>
                        )}
                        <button
                          type="button"
                          className="draft-operator-action draft-operator-action--pick"
                          aria-label={`Reroll ${operator.name}`}
                          aria-describedby={singleWarning ? singleWarningId : undefined}
                          disabled={rolling || !canReroll}
                          title={
                            kept ? 'Turn off Keep to reroll' : canReroll || singleWarning ? undefined : 'No eligible replacement'
                          }
                          onClick={() => rerollSquad(index)}
                        >
                          Reroll
                        </button>
                        <button
                          type="button"
                          className="draft-operator-action"
                          aria-label={`Keep ${operator.name}`}
                          aria-pressed={kept}
                          disabled={rolling || locked}
                          onClick={() => setKeptSlots((current) =>
                            current.includes(index)
                              ? current.filter((slotIndex) => slotIndex !== index)
                              : [...current, index],
                          )}
                        >
                          Keep
                        </button>
                      </div>
                    }
                  />
                ) : lockedPresentation ? (
                  <LockedSlotCard
                    presentation={lockedPresentation}
                    constraint={slotConstraint}
                    operators={indicatorOperators}
                    slot={slot}
                    onModify={() => setEditingSlot(index)}
                    onReset={() => resetSlotConstraint(index)}
                  />
                ) : (
                  <RandomOperatorCard
                    slot={slot}
                    constraint={slotConstraint}
                    constrained={constrained}
                    onModify={() => setEditingSlot(index)}
                    onReset={() => resetSlotConstraint(index)}
                  />
                )}
                {inRange && constrained && !operator && !lockedPresentation && (
                  <SlotClassConstraintIndicator
                    constraint={slotConstraint}
                    operators={indicatorOperators}
                  />
                )}
              </div>
            )
          })}
        </div>

        {chainMode && (
          <details className="squad-filter-disclosure" onToggle={(event) => setChainPoolOpen(event.currentTarget.open)}>
            <summary>Operator Pool ({availableChainOperators.length} / {chainPoolSize})</summary>
            <div className="squad-filter-content">
              <div className="chain-pool-toolbar">
                <div className="draft-status-main chain-pool-views" role="group" aria-label="Operator Pool view">
                  <div className="draft-status-item">
                    <span>Pool</span>
                    <strong>{chainPoolSize}</strong>
                  </div>
                  <button
                    type="button"
                    className="draft-status-item"
                    aria-pressed={chainPoolView === 'exhausted'}
                    onClick={() => setChainPoolView('exhausted')}
                  >
                    <span>Exhausted</span>
                    <strong>{chain?.exhausted.length ?? 0}</strong>
                  </button>
                  <button
                    type="button"
                    className="draft-status-item"
                    aria-pressed={chainPoolView === 'available'}
                    onClick={() => setChainPoolView('available')}
                  >
                    <span>Available to draw</span>
                    <strong>{availableChainOperators.length}</strong>
                  </button>
                </div>
                <div className="chain-pool-sort">
                  <PoolSortControls
                    operatorSort={chainPoolSort}
                    groupBy={chainPoolGroup}
                    onSortChange={setChainPoolSort}
                    onGroupChange={setChainPoolGroup}
                  />
                </div>
              </div>
              {chainPoolOpen && (
                <div className="chain-pool-operators">
                  {displayedChainOperators.length === 0 ? (
                    <p>{showingExhausted ? 'No exhausted operators yet.' : 'No operators available to draw.'}</p>
                  ) : (
                    <>
                      {!showingExhausted && <p>Slot requirements and squad composition rules still apply.</p>}
                      {chainOperatorGroups.map(([label, operators]) => (
                        <section key={label} data-rarity={chainPoolGroup === 'rarity' ? operators[0].rarity : undefined}>
                          {chainPoolGroup !== 'none' && <h3>{label} ({operators.length})</h3>}
                          <ul>
                            {operators.map((operator) => (
                              <li key={operator.id}>
                                <span className="chain-pool-operator-icons" aria-hidden="true">
                                  <CompactOperatorAvatar operator={operator} />
                                </span>
                                <span>{operator.name} <small>{operator.class}</small></span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </details>
        )}

        <details className="squad-filter-disclosure">
          <summary>Squad filters</summary>
          <div className="squad-filter-content">
            <div className="squad-size-control">
              <div className="squad-size-heading">
                <span>Squad size</span>
                <strong>{constraints.squadSize}</strong>
              </div>
              <div className="squad-size-slider-row">
                <span>1</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={constraints.squadSize}
                  disabled={squad.length > 0}
                  aria-label="Squad size"
                  onChange={(event) => changeSquadSize(Number(event.target.value))}
                />
                <span>12</span>
              </div>
              {squad.length > 0 && (
                <small>Clear the generated squad to change its size or slot constraints.</small>
              )}
            </div>
            <div className="squad-bounds-layout">
              <fieldset className="constraint-group squad-bound-group">
                <legend>Rarity bounds</legend>
                <div className="bound-grid">
                  {[...operatorRarities].reverse().map((rarity) => (
                    <BoundPill
                      key={rarity}
                      label={
                        <span
                          className="bound-rarity-stars"
                          style={{ color: `var(--rarity-${rarity})` }}
                        >
                          {'★'.repeat(rarity)}
                        </span>
                      }
                      labelText={`${rarity}★`}
                      value={constraints.rarity[rarity]}
                      disabled={squad.length > 0}
                      onSave={(next) => saveRarityBound(rarity, next)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="constraint-group squad-bound-group">
                <legend>Aggregate rarity group</legend>
                <div className="bound-grid bound-grid--aggregate">
                  {rarityGroupKeys.map((group) => (
                    <BoundPill
                      key={group}
                      label={rarityGroupDefinitions[group].label}
                      value={constraints.rarityGroups[group]}
                      disabled={squad.length > 0}
                      onSave={(next) => saveRarityGroupBound(group, next)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="constraint-group squad-bound-group squad-bound-group--classes">
                <legend>Class bounds</legend>
                <div className="bound-grid bound-grid--classes">
                  {operatorClasses.map((operatorClass) => {
                    const classLabel = dataset?.classLabels?.[operatorClass] ?? operatorClass
                    return (
                      <BoundPill
                        key={operatorClass}
                        label={
                          <span className="bound-class-label">
                            <ClassIcon operatorClass={operatorClass} className="bound-class-icon" />
                            <span>{classLabel}</span>
                          </span>
                        }
                        labelText={classLabel}
                        value={constraints.class[operatorClass]}
                        disabled={squad.length > 0}
                        onSave={(next) => saveClassBound(operatorClass, next)}
                      />
                    )
                  })}
                </div>
              </fieldset>
            </div>
          </div>
        </details>
      </section>
      {editingSlot !== null &&
        dataset &&
        squad.length === 0 &&
        editingSlot < constraints.squadSize && (
          <SquadConstraintEditor
            slotIndex={editingSlot}
            value={constraints.slots[editingSlot] ?? createEmptySlotConstraint()}
            resetValue={
              selectedPreset?.configuration.slots[editingSlot] ?? createEmptySlotConstraint()
            }
            constraints={constraints}
            operators={finalOperatorPool}
            subclassReferenceOperators={dataset.operators}
            classLabels={dataset.classLabels}
            onApply={(value) => saveSlotConstraint(editingSlot, value)}
            onClose={() => setEditingSlot(null)}
          />
        )}
      {presetNameDialog && (
        <TextInputDialog
          title={
            presetNameDialog.mode === 'save'
              ? 'Save squad preset'
              : presetNameDialog.mode === 'duplicate'
                ? 'Duplicate squad preset'
                : 'Rename squad preset'
          }
          initialValue={presetNameDialog.initialValue}
          confirmLabel={
            presetNameDialog.mode === 'save'
              ? 'Save'
              : presetNameDialog.mode === 'duplicate'
                ? 'Duplicate'
                : 'Rename'
          }
          onCancel={() => setPresetNameDialog(null)}
          onConfirm={confirmPresetName}
        />
      )}
      {pendingConfirmation && (
        <ConfirmationDialog
          confirmation={pendingConfirmation}
          dontShowAgain={dontShowAgain}
          setDontShowAgain={setDontShowAgain}
          onCancel={() => {
            setPendingConfirmation(null)
            setDontShowAgain(false)
          }}
          onConfirm={confirmPending}
        />
      )}
    </>
  )
}
