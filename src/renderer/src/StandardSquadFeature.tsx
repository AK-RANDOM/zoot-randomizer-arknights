import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import BoundPill from './BoundPill'
import ClassIcon from './ClassIcon'
import LockedSlotCard, { lockedSlotPresentation } from './LockedSlotCard'
import OperatorCard from './OperatorCard'
import SquadConstraintEditor from './SquadConstraintEditor'
import SlotClassConstraintIndicator from './SlotClassConstraintIndicator'
import TextInputDialog from './TextInputDialog'
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
import { generateSquad, validateConstraints } from '../../shared/randomizer'
import {
  dismissWarning,
  loadUserSquadPresets,
  saveUserSquadPresets,
  warningIsDismissed,
} from './rendererPersistence'

const slots = Array.from({ length: 12 }, (_, index) => index + 1)
const BOUND_WARNING_KEY = 'arknights-randomizer:dismiss-bound-reset-warning'
const PRESET_WARNING_KEY = 'arknights-randomizer:dismiss-preset-replace-warning'
const AMIYA_MANDATORY_GROUP = 'amiya-forms'
const AMIYA_CLASS_ORDER: readonly OperatorClass[] = ['Caster', 'Guard', 'Medic']

interface PendingConfirmation {
  title: string
  body: string
  confirmLabel: string
  preferenceKey: string
  apply: () => void
}

function sameValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function raritySetSummary(rarities: readonly OperatorRarity[]): string {
  if (rarities.length === 0) return 'Any rarity'
  for (const group of rarityGroupKeys) {
    const definition = rarityGroupDefinitions[group]
    if (sameValues(rarities, definition.rarities)) return definition.label
  }
  return [...rarities]
    .sort((left, right) => left - right)
    .map((rarity) => `${rarity}★`)
    .join(' / ')
}

function classSetSummary(
  classes: readonly OperatorClass[],
  classLabels?: Readonly<Record<OperatorClass, string>>,
): string {
  if (classes.length === 0) return 'Any class'
  return operatorClasses
    .filter((operatorClass) => classes.includes(operatorClass))
    .map((operatorClass) => classLabels?.[operatorClass] ?? operatorClass)
    .join(' / ')
}

function amiyaClassSummary(
  constraint: SlotConstraint,
  classLabels?: Readonly<Record<OperatorClass, string>>,
): string {
  const classes =
    constraint.classes.length > 0
      ? AMIYA_CLASS_ORDER.filter((operatorClass) => constraint.classes.includes(operatorClass))
      : AMIYA_CLASS_ORDER
  return classes.map((operatorClass) => classLabels?.[operatorClass] ?? operatorClass).join(' / ')
}

function specificOperatorSummary(
  constraint: SlotConstraint,
  dataset: OperatorDataset | null,
): string | null {
  if (constraint.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP) {
    return `Amiya — ${amiyaClassSummary(constraint, dataset?.classLabels)}`
  }
  if (constraint.mandatoryExclusivityGroup)
    return `Any form — ${constraint.mandatoryExclusivityGroup}`
  if (!constraint.operatorId) return null
  const operator = dataset?.operators.find((candidate) => candidate.id === constraint.operatorId)
  if (!operator) return constraint.operatorId
  if (operator.mandatoryExclusivityGroup === AMIYA_MANDATORY_GROUP) {
    return `Amiya — ${dataset?.classLabels?.[operator.class] ?? operator.class}`
  }
  return operator.name
}

function rarityGradient(rarities: readonly OperatorRarity[]): string | null {
  if (rarities.length === 0) return null
  const sorted = [...new Set(rarities)].sort((left, right) => right - left)
  const colors = sorted.map((rarity) => `var(--rarity-${rarity})`)
  return colors.length === 1
    ? `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`
    : `linear-gradient(135deg, ${colors.join(', ')})`
}

function slotConfigCardStyle(rarities: readonly OperatorRarity[]): CSSProperties | undefined {
  const gradient = rarityGradient(rarities)
  if (!gradient) return undefined
  return {
    '--slot-constraint-gradient': gradient,
    border: '3px solid transparent',
    background: `linear-gradient(#17140e, #17140e) padding-box, ${gradient} border-box`,
  } as CSSProperties
}

function numericSummary(label: string, constraint: NumericConstraint | undefined): string | null {
  const resolved = resolveNumericConstraint(constraint)
  if (numericConstraintIsDefault(resolved)) return null
  if (resolved.min === resolved.max) return `Exactly ${resolved.min} ${label}`
  if (resolved.min > 0 && resolved.max === 12) return `At least ${resolved.min} ${label}`
  if (resolved.min === 0 && resolved.max < 12) return `At most ${resolved.max} ${label}`
  return `${resolved.min}–${resolved.max} ${label}`
}

function ValidationBox({ errors }: { errors: string[] }): React.JSX.Element {
  return (
    <div className="validation-box" role="alert">
      <strong>Current configuration cannot generate a squad.</strong>
      <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
    </div>
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
        <label className="confirmation-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          <span>Don&apos;t show this warning again</span>
        </label>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="randomize-button" onClick={onConfirm}>{confirmation.confirmLabel}</button>
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
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [userPresets, setUserPresets] = useState<StoredSquadPreset[]>(() => loadUserSquadPresets())
  const [selectedPresetId, setSelectedPresetId] = useState('builtin:none')
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [presetNameDialog, setPresetNameDialog] = useState<
    { mode: 'save' | 'duplicate' | 'rename'; initialValue: string } | null
  >(null)
  const lastResetRevision = useRef(resetRevision)

  useEffect(() => { saveUserSquadPresets(userPresets) }, [userPresets])
  useEffect(() => {
    if (!dataset || squad.length === 0) return
    const byId = new Map(dataset.operators.map((operator) => [operator.id, operator]))
    setSquad((current) => current.map((operator) => byId.get(operator.id) ?? operator))
  }, [dataset])
  useEffect(() => {
    if (lastResetRevision.current === resetRevision) return
    lastResetRevision.current = resetRevision
    setSquad([])
    setEditingSlot(null)
  }, [resetRevision])

  const validation = useMemo(
    () => dataset ? validateConstraints(constraints, finalOperatorPool) : { valid: false, errors: [] },
    [constraints, dataset, finalOperatorPool],
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
    () => !selectedPreset || !squadConfigurationEquals(currentSquadConfiguration, selectedPreset.configuration),
    [currentSquadConfiguration, selectedPreset],
  )
  const resetConfiguration = useMemo(
    () => selectedPreset ? cloneSquadConfiguration(selectedPreset.configuration) : createNoConstraintConfiguration(constraints.squadSize),
    [constraints.squadSize, selectedPreset],
  )
  const canResetConstraints = squad.length === 0 && !squadConfigurationEquals(currentSquadConfiguration, resetConfiguration)

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
    if (dontShowAgain) dismissWarning(pendingConfirmation.preferenceKey)
    setPendingConfirmation(null)
    setDontShowAgain(false)
    action()
  }
  const markCustom = (): void => { if (!selectedPreset) setSelectedPresetId('custom') }
  const changeSquadSize = (squadSize: number): void => {
    if (squad.length > 0) return
    onConstraintsChange((current) => ({
      ...current,
      squadSize,
      slots: current.slots.map((slot, index) =>
        index < squadSize ? cloneSlotConstraint(slot) : createEmptySlotConstraint(),
      ),
    }))
    setEditingSlot((current) => current !== null && current >= squadSize ? null : current)
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

  const currentConstraintSummary = useMemo(() => {
    const items: string[] = []
    for (const rarity of [...operatorRarities].reverse()) {
      const summary = numericSummary(`${rarity}★`, constraints.rarity[rarity])
      if (summary) items.push(summary)
    }
    for (const group of rarityGroupKeys) {
      const summary = numericSummary(rarityGroupDefinitions[group].label, constraints.rarityGroups[group])
      if (summary) items.push(summary)
    }
    for (const operatorClass of operatorClasses) {
      const summary = numericSummary(dataset?.classLabels?.[operatorClass] ?? operatorClass, constraints.class[operatorClass])
      if (summary) items.push(summary)
    }
    return items
  }, [constraints.class, constraints.rarity, constraints.rarityGroups, dataset])

  const resetConstraints = (): void => {
    if (!canResetConstraints) return
    onConstraintsChange((current) => applySquadConfiguration(current, resetConfiguration))
    setEditingSlot(null)
    if (!selectedPreset) setSelectedPresetId('custom')
    onError(null)
    onMessage(selectedPreset ? `Constraints reset to preset “${selectedPreset.name}”.` : 'Custom constraints reset to a blank slate. Global Pool filters were preserved.')
  }
  const clearSquad = (): void => {
    setSquad([])
    onError(null)
    onMessage('Squad cleared. Slot constraints are ready to edit.')
  }
  const applyBoundChange = (
    label: string,
    update: (current: RandomizerConstraints) => RandomizerConstraints,
  ): void => requestConfirmation(
    BOUND_WARNING_KEY,
    'Apply boundary change?',
    `Changing the ${label} squad bound will reset every slot constraint to Any / Any and clear the generated squad.`,
    'Apply & Reset',
    () => {
      onConstraintsChange((current) => ({ ...update(current), slots: createEmptySlotConstraints() }))
      setSquad([])
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
      setEditingSlot(null)
      setSelectedPresetId(preset.id)
      onError(null)
      onMessage(`Applied squad preset “${preset.name}”.`)
    }
    if (squadConfigurationEquals(currentSquadConfiguration, preset.configuration)) {
      setSelectedPresetId(preset.id)
      return
    }
    if (!squadConfigurationEquals(currentSquadConfiguration, BUILT_IN_SQUAD_PRESETS[0].configuration)) {
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
    setUserPresets((current) => current.map((preset) =>
      preset.id === selectedPreset.id
        ? { ...preset, configuration: cloneSquadConfiguration(currentSquadConfiguration) }
        : preset,
    ))
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
      setUserPresets((current) => current.map((preset) =>
        preset.id === selectedPreset.id ? { ...preset, name } : preset,
      ))
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
    if (!selectedPreset || selectedPreset.builtIn || !window.confirm(`Delete squad preset “${selectedPreset.name}”?`)) return
    setUserPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id))
    setSelectedPresetId('custom')
    onMessage(`Deleted squad preset “${selectedPreset.name}”.`)
  }
  const randomize = (): void => {
    if (!dataset) return
    onError(null)
    const result = validateConstraints(constraints, finalOperatorPool)
    if (!result.valid) {
      onError(result.errors.join(' '))
      return
    }
    try {
      setSquad(generateSquad(finalOperatorPool, constraints))
      onMessage(`Generated a squad of ${constraints.squadSize} operators.`)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return <>
    <section className="panel squad-panel" aria-labelledby="squad-heading">
      <div className="section-heading">
        <div><p className="eyebrow">GET SQUAD • STANDARD</p><h2 id="squad-heading">Standard squad</h2></div>
        <div className="section-actions">
          {canResetConstraints && <button className="danger-button" type="button" onClick={resetConstraints}>Reset Constraints</button>}
          {squad.length > 0 && <button className="secondary-button" type="button" onClick={clearSquad}>Clear Squad</button>}
          <button className="randomize-button" type="button" disabled={!dataset || !validation.valid} onClick={randomize}>{squad.length > 0 ? 'Randomize Again' : 'Randomize'}</button>
        </div>
      </div>

      <div className="preset-toolbar">
        <label className="preset-select">
          <span>Squad preset</span>
          <select value={presetIsDirty ? 'custom' : selectedPresetId} onChange={(event) => {
            const id = event.target.value
            if (id === 'custom') { setSelectedPresetId('custom'); return }
            const preset = allPresets.find((candidate) => candidate.id === id)
            if (preset) applyPreset(preset)
          }}>
            <option value="custom">Custom</option>
            <optgroup label="Built-in">{BUILT_IN_SQUAD_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>
            {userPresets.length > 0 && <optgroup label="Saved">{userPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>}
          </select>
        </label>
        <div className="preset-actions">
          <button type="button" className="secondary-button" onClick={saveAsPreset}>Save as preset…</button>
          {selectedPreset && <button type="button" className="secondary-button" onClick={duplicateSelectedPreset}>Duplicate</button>}
          {selectedPreset && !selectedPreset.builtIn && <>
            <button type="button" className="secondary-button" onClick={updateSelectedPreset}>Update</button>
            <button type="button" className="secondary-button" onClick={renameSelectedPreset}>Rename</button>
            <button type="button" className="secondary-button" onClick={deleteSelectedPreset}>Delete</button>
          </>}
        </div>
      </div>

      <div className="current-constraint-summary" aria-label="Current squad constraints">
        <strong>Current constraints</strong>
        {currentConstraintSummary.length > 0
          ? <div>{currentConstraintSummary.map((summary) => <span key={summary}>{summary}</span>)}</div>
          : <p>No active squad-wide constraints.</p>}
      </div>
      {dataset && !validation.valid && validation.errors.length > 0 && <ValidationBox errors={validation.errors} />}

      <div className="squad-grid">{slots.map((slot, index) => {
        const operator = squad[index]
        const inRange = index < constraints.squadSize
        const slotConstraint = constraints.slots[index] ?? createEmptySlotConstraint()
        const constrained = !slotConstraintIsEmpty(slotConstraint)
        const specificSummary = specificOperatorSummary(slotConstraint, dataset)
        const indicatorOperators = dataset?.operators ?? finalOperatorPool
        const lockedPresentation = !operator && inRange && constrained && (slotConstraint.operatorId || slotConstraint.mandatoryExclusivityGroup)
          ? lockedSlotPresentation(slotConstraint, finalOperatorPool)
          : null
        return <div className={`squad-slot${!inRange ? ' squad-slot--disabled' : ''}`} key={slot}>
          {!inRange
            ? <div className="disabled-slot" aria-label={`Squad slot ${slot} unavailable`}><span className="slot-config-number">{slot}</span><span>Unavailable</span><small>Squad size {constraints.squadSize}</small></div>
            : operator
              ? <OperatorCard operator={operator} />
              : lockedPresentation
                ? <LockedSlotCard presentation={lockedPresentation} constraint={slotConstraint} operators={indicatorOperators} slot={slot} onClick={() => setEditingSlot(index)} />
                : <button
                    type="button"
                    className={`slot-config-card${constrained ? ' is-constrained' : ''}`}
                    style={slotConfigCardStyle(slotConstraint.rarities)}
                    aria-label={`Configure squad slot ${slot}`}
                    onClick={() => setEditingSlot(index)}
                  >
                    <span className="slot-config-number">{slot}</span>
                    {constrained
                      ? <span className="slot-config-summary"><strong>{raritySetSummary(slotConstraint.rarities)}</strong><span>{classSetSummary(slotConstraint.classes, dataset?.classLabels)}</span>{specificSummary && <span className="slot-config-specific">{specificSummary}</span>}</span>
                      : <span className="slot-config-any"><strong>Any</strong><span>Click to configure</span></span>}
                  </button>}
          {inRange && constrained && !operator && !lockedPresentation && (
            <SlotClassConstraintIndicator constraint={slotConstraint} operators={indicatorOperators} />
          )}
        </div>
      })}</div>

      <details className="squad-filter-disclosure">
        <summary>Squad filters</summary>
        <div className="squad-filter-content">
          <div className="squad-size-control">
            <div className="squad-size-heading"><span>Squad size</span><strong>{constraints.squadSize}</strong></div>
            <div className="squad-size-slider-row"><span>1</span><input type="range" min={1} max={12} step={1} value={constraints.squadSize} disabled={squad.length > 0} aria-label="Squad size" onChange={(event) => changeSquadSize(Number(event.target.value))} /><span>12</span></div>
            {squad.length > 0 && <small>Clear the generated squad to change its size or slot constraints.</small>}
          </div>
          <div className="squad-bounds-layout">
            <fieldset className="constraint-group squad-bound-group">
              <legend>Rarity bounds</legend>
              <div className="bound-grid">{[...operatorRarities].reverse().map((rarity) => <BoundPill key={rarity} label={<span className="bound-rarity-stars" style={{ color: `var(--rarity-${rarity})` }}>{'★'.repeat(rarity)}</span>} labelText={`${rarity}★`} value={constraints.rarity[rarity]} disabled={squad.length > 0} onSave={(next) => saveRarityBound(rarity, next)} />)}</div>
            </fieldset>
            <fieldset className="constraint-group squad-bound-group">
              <legend>Aggregate rarity group</legend>
              <div className="bound-grid bound-grid--aggregate">{rarityGroupKeys.map((group) => <BoundPill key={group} label={rarityGroupDefinitions[group].label} value={constraints.rarityGroups[group]} disabled={squad.length > 0} onSave={(next) => saveRarityGroupBound(group, next)} />)}</div>
            </fieldset>
            <fieldset className="constraint-group squad-bound-group squad-bound-group--classes">
              <legend>Class bounds</legend>
              <div className="bound-grid bound-grid--classes">{operatorClasses.map((operatorClass) => <BoundPill key={operatorClass} label={<ClassIcon operatorClass={operatorClass} className="bound-class-icon" />} labelText={dataset?.classLabels?.[operatorClass] ?? operatorClass} value={constraints.class[operatorClass]} disabled={squad.length > 0} onSave={(next) => saveClassBound(operatorClass, next)} />)}</div>
            </fieldset>
          </div>
        </div>
      </details>
    </section>
    {editingSlot !== null && dataset && squad.length === 0 && editingSlot < constraints.squadSize && <SquadConstraintEditor slotIndex={editingSlot} value={constraints.slots[editingSlot] ?? createEmptySlotConstraint()} resetValue={selectedPreset?.configuration.slots[editingSlot] ?? createEmptySlotConstraint()} constraints={constraints} operators={finalOperatorPool} classLabels={dataset.classLabels} onApply={(value) => saveSlotConstraint(editingSlot, value)} onClose={() => setEditingSlot(null)} />}
    {presetNameDialog && <TextInputDialog title={presetNameDialog.mode === 'save' ? 'Save squad preset' : presetNameDialog.mode === 'duplicate' ? 'Duplicate squad preset' : 'Rename squad preset'} initialValue={presetNameDialog.initialValue} confirmLabel={presetNameDialog.mode === 'save' ? 'Save' : presetNameDialog.mode === 'duplicate' ? 'Duplicate' : 'Rename'} onCancel={() => setPresetNameDialog(null)} onConfirm={confirmPresetName} />}
    {pendingConfirmation && <ConfirmationDialog confirmation={pendingConfirmation} dontShowAgain={dontShowAgain} setDontShowAgain={setDontShowAgain} onCancel={() => { setPendingConfirmation(null); setDontShowAgain(false) }} onConfirm={confirmPending} />}
  </>
}
