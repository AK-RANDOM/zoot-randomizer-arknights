import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import BoundPill from './BoundPill'
import ClassIcon from './ClassIcon'
import Iteration6OperatorFilters from './Iteration6OperatorFilters'
import OperatorCard from './OperatorCard'
import OptionsPanel from './OptionsPanel'
import PoolPanel from './PoolPanel'
import SquadConstraintEditor from './SquadConstraintEditor'
import {
  loadOperatorPreferences,
  saveOperatorPreferences,
} from './operatorPreferencesStorage'
import {
  cloneSlotConstraint,
  createDefaultConstraints,
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
  createUserPreset,
  squadConfigurationEquals,
  squadConfigurationFromConstraints,
  type SquadPreset,
  type StoredSquadPreset,
} from '../../shared/presets'
import {
  limitedAcquisitionGroups,
  operatorClasses,
  operatorRarities,
  welfareAcquisitionGroups,
  type LimitedAcquisitionGroup,
  type Operator,
  type OperatorClass,
  type OperatorDataset,
  type OperatorRarity,
  type ReleaseServer,
  type WelfareAcquisitionGroup,
} from '../../shared/operator'
import {
  buildFinalOperatorPool,
  reconcileOperatorPreferences,
  type OperatorPreferences,
  type PoolPresentationMode,
} from '../../shared/operatorPool'
import type { OperatorDataInfo, OperatorUpdateCheck } from '../../shared/desktop'
import { generateSquad, validateConstraints } from '../../shared/randomizer'
import {
  getReleaseBoundPreview,
  type ReleaseBoundPreview,
} from '../../shared/releasePreview'
import {
  applyCustomReleaseDate,
  applyReleaseGroupSelection,
  releaseGroupLabel,
  releaseGroupSelectValue,
  releaseRangeIsValid,
  remapReleaseConstraintServer,
} from '../../shared/releaseBounds'

const slots = Array.from({ length: 12 }, (_, index) => index + 1)
const USER_PRESETS_KEY = 'arknights-randomizer:squad-presets:v1'
const BOUND_WARNING_KEY = 'arknights-randomizer:dismiss-bound-reset-warning'
const PRESET_WARNING_KEY = 'arknights-randomizer:dismiss-preset-replace-warning'
const INVALID_RELEASE_RANGE_MESSAGE =
  'Invalid operator release range\n\nThe maximum release bound cannot be earlier than the minimum release bound.\nPlease adjust one of the release bounds.'

type AppTab = 'squads' | 'operators' | 'pool' | 'options'

const limitedLabels: Record<LimitedAcquisitionGroup, string> = {
  anniversary: 'Anniversary',
  halfAnniversary: 'Half-Anniversary',
  cny: 'CNY',
  summer: 'Summer',
  collab: 'Collab',
}

const welfareLabels: Record<WelfareAcquisitionGroup, string> = {
  eventStory: 'Event / Story',
  redCert: 'Red Cert',
  cc: 'CC',
  isRa: 'IS / RA',
}

interface PendingConfirmation {
  title: string
  body: string
  confirmLabel: string
  preferenceKey: string
  apply: () => void
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'unknown' : date.toLocaleDateString()
}

function TriStateCheckbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: ReactNode
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label className="source-check">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function TreeGroup({
  label,
  checked,
  indeterminate,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div className="source-tree-group">
      <div className="source-tree-heading">
        <button
          type="button"
          className="tree-toggle"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '▾' : '▸'}
        </button>
        <TriStateCheckbox
          label={<strong>{label}</strong>}
          checked={checked}
          indeterminate={indeterminate}
          onChange={onChange}
        />
      </div>
      {open && <div className="source-tree-children">{children}</div>}
    </div>
  )
}

function RepresentativePortrait({ operator }: { operator: Operator }): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorImage(operator.id).then((url) => {
      if (active) setImageUrl(url)
    })
    return () => {
      active = false
    }
  }, [operator.id])

  return (
    <span
      className="release-representative"
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

function ReleasePreviewStrip({
  label,
  preview,
}: {
  label: string
  preview: ReleaseBoundPreview | null
}): React.JSX.Element {
  if (!preview) {
    return <div className="release-preview release-preview--empty">No matching release event</div>
  }

  const representatives = [...preview.sixStar, ...preview.fiveStar]
  return (
    <div className="release-preview">
      <div className="release-preview__meta">
        <span>{label}</span>
        <strong>{preview.date}</strong>
      </div>
      <div className="release-preview__portraits">
        {representatives.length > 0 ? (
          representatives.map((operator) => (
            <RepresentativePortrait key={operator.id} operator={operator} />
          ))
        ) : (
          <span className="release-preview__none">No 6★/5★ on this date</span>
        )}
      </div>
    </div>
  )
}

function allAndSome(values: boolean[]): { all: boolean; some: boolean } {
  return {
    all: values.length > 0 && values.every(Boolean),
    some: values.some(Boolean),
  }
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

function classSetSummary(classes: readonly OperatorClass[]): string {
  if (classes.length === 0) return 'Any class'
  return operatorClasses.filter((operatorClass) => classes.includes(operatorClass)).join(' / ')
}

function storedPreference(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function savePreference(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Preference persistence is optional; the action itself should still succeed.
  }
}

function isStoredPreset(value: unknown): value is StoredSquadPreset {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredSquadPreset>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    candidate.builtIn === false &&
    !!candidate.configuration &&
    typeof candidate.configuration === 'object'
  )
}

function loadUserPresets(): StoredSquadPreset[] {
  try {
    const raw = window.localStorage.getItem(USER_PRESETS_KEY)
    if (!raw) return []
    const envelope = JSON.parse(raw) as { version?: unknown; presets?: unknown }
    if (envelope.version !== 1 || !Array.isArray(envelope.presets)) return []
    return envelope.presets.filter(isStoredPreset).map((preset) => ({
      ...preset,
      builtIn: false,
      configuration: cloneSquadConfiguration(preset.configuration),
    }))
  } catch {
    return []
  }
}

function ValidationBox({ errors }: { errors: string[] }): React.JSX.Element {
  return (
    <div className="validation-box" role="alert">
      <strong>Current configuration cannot generate a squad.</strong>
      <ul>
        {errors.map((validationError) => (
          <li key={validationError}>{validationError}</li>
        ))}
      </ul>
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

export default function App(): React.JSX.Element {
  const [dataset, setDataset] = useState<OperatorDataset | null>(null)
  const [dataInfo, setDataInfo] = useState<OperatorDataInfo | null>(null)
  const [operatorPreferences, setOperatorPreferences] = useState<OperatorPreferences>(() =>
    loadOperatorPreferences(),
  )
  const [constraints, setConstraints] = useState<RandomizerConstraints>(() => {
    const next = createDefaultConstraints()
    next.release.server = operatorPreferences.metadataRegion
    return next
  })
  const [squad, setSquad] = useState<Operator[]>([])
  const [message, setMessage] = useState('Loading operator data…')
  const [error, setError] = useState<string | null>(null)
  const [updateCheck, setUpdateCheck] = useState<OperatorUpdateCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>('squads')
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [userPresets, setUserPresets] = useState<StoredSquadPreset[]>(() => loadUserPresets())
  const [selectedPresetId, setSelectedPresetId] = useState('builtin:none')
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const loadData = useCallback(async () => {
    const [nextDataset, nextInfo] = await Promise.all([
      window.desktop.getOperatorDataset(),
      window.desktop.getOperatorDataInfo(),
    ])
    setDataset(nextDataset)
    setDataInfo(nextInfo)
    setOperatorPreferences((current) =>
      reconcileOperatorPreferences(current, nextDataset.operators),
    )
    setMessage(`${nextDataset.operators.length} operators ready.`)
  }, [])

  useEffect(() => {
    void loadData().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
      setMessage('Operator data could not be loaded.')
    })
  }, [loadData])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_PRESETS_KEY,
        JSON.stringify({ version: 1, presets: userPresets }),
      )
    } catch {
      // Custom presets still work for this session if persistent storage is unavailable.
    }
  }, [userPresets])

  useEffect(() => {
    saveOperatorPreferences(operatorPreferences)
  }, [operatorPreferences])

  const finalOperatorPool = useMemo(
    () =>
      dataset
        ? buildFinalOperatorPool(
            dataset.operators,
            constraints,
            operatorPreferences.excludedOperatorIds,
          )
        : [],
    [constraints, dataset, operatorPreferences.excludedOperatorIds],
  )

  const validation = useMemo(
    () =>
      dataset
        ? validateConstraints(constraints, finalOperatorPool)
        : { valid: false, errors: [] },
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
    () =>
      !selectedPreset ||
      !squadConfigurationEquals(currentSquadConfiguration, selectedPreset.configuration),
    [currentSquadConfiguration, selectedPreset],
  )

  const maxReleaseYear = useMemo(() => {
    if (!dataset) return 0
    const server = constraints.release.server
    return dataset.operators.reduce(
      (maximum, operator) => Math.max(maximum, operator.release[server].yearGroup ?? 0),
      0,
    )
  }, [constraints.release.server, dataset])

  const releaseYearOptions = useMemo(
    () => Array.from({ length: maxReleaseYear + 1 }, (_, index) => index),
    [maxReleaseYear],
  )

  const collaborationSources = useMemo(() => {
    if (!dataset) return []
    return [...new Set(dataset.operators.flatMap((operator) => operator.collaboration ?? []))].sort(
      (left, right) => left.localeCompare(right),
    )
  }, [dataset])

  const minReleasePreview = useMemo(
    () =>
      dataset
        ? getReleaseBoundPreview(dataset.operators, constraints.release, 'min')
        : null,
    [constraints.release, dataset],
  )
  const maxReleasePreview = useMemo(
    () =>
      dataset
        ? getReleaseBoundPreview(dataset.operators, constraints.release, 'max')
        : null,
    [constraints.release, dataset],
  )

  const limitedState = allAndSome(
    limitedAcquisitionGroups.map((group) => constraints.acquisition.limited[group]),
  )
  const welfareState = allAndSome(
    welfareAcquisitionGroups.map((group) => constraints.acquisition.welfare[group]),
  )
  const collaborationState = allAndSome([
    constraints.collaboration.includeNonCollab,
    ...collaborationSources.map(
      (source) => constraints.collaboration.sources[source] ?? true,
    ),
  ])

  const requestConfirmation = (
    preferenceKey: string,
    title: string,
    body: string,
    confirmLabel: string,
    apply: () => void,
  ): void => {
    if (storedPreference(preferenceKey)) {
      apply()
      return
    }
    setDontShowAgain(false)
    setPendingConfirmation({ title, body, confirmLabel, preferenceKey, apply })
  }

  const confirmPending = (): void => {
    if (!pendingConfirmation) return
    const action = pendingConfirmation.apply
    if (dontShowAgain) savePreference(pendingConfirmation.preferenceKey)
    setPendingConfirmation(null)
    setDontShowAgain(false)
    action()
  }

  const markCustom = (): void => {
    if (!selectedPreset) setSelectedPresetId('custom')
  }

  const changeSquadSize = (squadSize: number): void => {
    if (squad.length > 0) return
    setConstraints((current) => {
      const nextSlots = current.slots.map((slot, index) =>
        index < squadSize ? cloneSlotConstraint(slot) : createEmptySlotConstraint(),
      )
      return { ...current, squadSize, slots: nextSlots }
    })
    setEditingSlot((current) => (current !== null && current >= squadSize ? null : current))
    markCustom()
    setError(null)
  }

  const saveSlotConstraint = (slotIndex: number, value: SlotConstraint): void => {
    setConstraints((current) => {
      const nextSlots = current.slots.map((slot) => cloneSlotConstraint(slot))
      nextSlots[slotIndex] = cloneSlotConstraint(value)
      return { ...current, slots: nextSlots }
    })
    setEditingSlot(null)
    markCustom()
    setError(null)
  }

  const constrainedInRange = constraints.slots.slice(0, constraints.squadSize)
  const constrainedSlots = constrainedInRange.filter((slot) => !slotConstraintIsEmpty(slot))
  const constraintsAlreadyPacked = constrainedInRange.every((slot, index) =>
    index < constrainedSlots.length ? !slotConstraintIsEmpty(slot) : slotConstraintIsEmpty(slot),
  )
  const canMoveConstraints = constrainedSlots.length > 0 && !constraintsAlreadyPacked

  const moveConstraintsToTop = (): void => {
    if (!canMoveConstraints || squad.length > 0) return
    setConstraints((current) => {
      const active = current.slots
        .slice(0, current.squadSize)
        .filter((slot) => !slotConstraintIsEmpty(slot))
        .map((slot) => cloneSlotConstraint(slot))
      const nextSlots = createEmptySlotConstraints()
      active.forEach((slot, index) => {
        nextSlots[index] = slot
      })
      return { ...current, slots: nextSlots }
    })
    setEditingSlot(null)
    markCustom()
  }

  const clearSquad = (): void => {
    setSquad([])
    setError(null)
    setMessage('Squad cleared. Slot constraints are ready to edit.')
  }

  const applyBoundChange = (
    label: string,
    update: (current: RandomizerConstraints) => RandomizerConstraints,
  ): void => {
    requestConfirmation(
      BOUND_WARNING_KEY,
      'Apply boundary change?',
      `Changing the ${label} squad bound will reset every slot constraint to Any / Any and clear the generated squad.`,
      'Apply & Reset',
      () => {
        setConstraints((current) => ({
          ...update(current),
          slots: createEmptySlotConstraints(),
        }))
        setSquad([])
        setEditingSlot(null)
        markCustom()
        setError(null)
        setMessage(`${label} bound saved. Slot constraints were reset.`)
      },
    )
  }

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
      setConstraints((current) => applySquadConfiguration(current, preset.configuration))
      setSquad([])
      setEditingSlot(null)
      setSelectedPresetId(preset.id)
      setError(null)
      setMessage(`Applied squad preset “${preset.name}”.`)
    }

    if (squadConfigurationEquals(currentSquadConfiguration, preset.configuration)) {
      setSelectedPresetId(preset.id)
      return
    }

    const defaultConfiguration = BUILT_IN_SQUAD_PRESETS[0].configuration
    if (!squadConfigurationEquals(currentSquadConfiguration, defaultConfiguration)) {
      requestConfirmation(
        PRESET_WARNING_KEY,
        `Apply “${preset.name}”?`,
        'This will replace the current squad size, composition bounds, and per-slot constraints. Operator eligibility filters will be preserved.',
        'Apply Preset',
        apply,
      )
    } else {
      apply()
    }
  }

  const saveAsPreset = (): void => {
    const name = window.prompt('Name this squad preset:')
    if (!name?.trim()) return
    const preset = createUserPreset(name, currentSquadConfiguration)
    setUserPresets((current) => [...current, preset])
    setSelectedPresetId(preset.id)
    setMessage(`Saved squad preset “${preset.name}”.`)
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
    setMessage(`Updated squad preset “${selectedPreset.name}”.`)
  }

  const renameSelectedPreset = (): void => {
    if (!selectedPreset || selectedPreset.builtIn) return
    const name = window.prompt('Rename squad preset:', selectedPreset.name)
    if (!name?.trim()) return
    setUserPresets((current) =>
      current.map((preset) =>
        preset.id === selectedPreset.id ? { ...preset, name: name.trim() } : preset,
      ),
    )
  }

  const duplicateSelectedPreset = (): void => {
    if (!selectedPreset) return
    const name = window.prompt('Name the duplicated preset:', `${selectedPreset.name} copy`)
    if (!name?.trim()) return
    const duplicate = createUserPreset(name, currentSquadConfiguration)
    setUserPresets((current) => [...current, duplicate])
    setSelectedPresetId(duplicate.id)
  }

  const deleteSelectedPreset = (): void => {
    if (!selectedPreset || selectedPreset.builtIn) return
    if (!window.confirm(`Delete squad preset “${selectedPreset.name}”?`)) return
    setUserPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id))
    setSelectedPresetId('custom')
    setMessage(`Deleted squad preset “${selectedPreset.name}”.`)
  }

  const mutateOperatorFilters = (
    update: (current: RandomizerConstraints) => RandomizerConstraints,
  ): void => {
    setConstraints((current) => update(current))
    setSquad([])
    setEditingSlot(null)
    setError(null)
  }

  const rejectInvalidReleaseRange = (): void => {
    window.alert(INVALID_RELEASE_RANGE_MESSAGE)
  }

  const commitReleaseChange = (nextRelease: RandomizerConstraints['release']): boolean => {
    if (!releaseRangeIsValid(nextRelease)) {
      rejectInvalidReleaseRange()
      return false
    }
    mutateOperatorFilters((current) => ({ ...current, release: nextRelease }))
    return true
  }

  const changeReleaseGroup = (side: 'min' | 'max', value: string): void => {
    if (!dataset || value === 'custom') return
    const yearGroup = value === '' ? null : Number(value)
    const nextRelease = applyReleaseGroupSelection(
      constraints.release,
      side,
      yearGroup,
      dataset.operators,
    )
    commitReleaseChange(nextRelease)
  }

  const changeReleaseDate = (side: 'min' | 'max', date: string): void => {
    const nextRelease = applyCustomReleaseDate(constraints.release, side, date)
    commitReleaseChange(nextRelease)
  }

  const setMetadataRegion = (server: ReleaseServer): void => {
    if (!dataset || server === constraints.release.server) return
    const nextRelease = remapReleaseConstraintServer(
      constraints.release,
      server,
      dataset.operators,
    )
    if (!releaseRangeIsValid(nextRelease)) {
      rejectInvalidReleaseRange()
      return
    }
    setOperatorPreferences((current) => ({ ...current, metadataRegion: server }))
    mutateOperatorFilters((current) => ({ ...current, release: nextRelease }))
    setMessage(`Metadata region changed to ${server === 'global' ? 'EN / Global' : 'CN'}.`)
  }

  const setPoolPresentation = (poolPresentation: PoolPresentationMode): void => {
    setOperatorPreferences((current) => ({ ...current, poolPresentation }))
  }

  const updatePoolPreferences = (next: OperatorPreferences): void => {
    const exclusionsChanged =
      next.excludedOperatorIds.length !== operatorPreferences.excludedOperatorIds.length ||
      next.excludedOperatorIds.some(
        (id, index) => id !== operatorPreferences.excludedOperatorIds[index],
      )
    setOperatorPreferences(next)
    if (exclusionsChanged) {
      setSquad([])
      setEditingSlot(null)
      setError(null)
      setMessage('Operator pool updated.')
    }
  }

  const setLimitedAll = (checked: boolean): void => {
    mutateOperatorFilters((current) => ({
      ...current,
      acquisition: {
        ...current.acquisition,
        limited: Object.fromEntries(
          limitedAcquisitionGroups.map((group) => [group, checked]),
        ) as RandomizerConstraints['acquisition']['limited'],
      },
    }))
  }

  const setWelfareAll = (checked: boolean): void => {
    mutateOperatorFilters((current) => ({
      ...current,
      acquisition: {
        ...current.acquisition,
        welfare: Object.fromEntries(
          welfareAcquisitionGroups.map((group) => [group, checked]),
        ) as RandomizerConstraints['acquisition']['welfare'],
      },
    }))
  }

  const setCollaborationAll = (checked: boolean): void => {
    mutateOperatorFilters((current) => ({
      ...current,
      collaboration: {
        includeNonCollab: checked,
        sources: Object.fromEntries(collaborationSources.map((source) => [source, checked])),
      },
    }))
  }

  const resetOperatorFilters = (): void => {
    const defaults = createDefaultConstraints()
    mutateOperatorFilters((current) => ({
      ...current,
      release: { ...defaults.release, server: current.release.server },
      acquisition: defaults.acquisition,
      collaboration: defaults.collaboration,
      subclass: defaults.subclass,
      faction: defaults.faction,
      era: defaults.era,
      alterExclusivity: defaults.alterExclusivity,
    }))
    setMessage('Operator eligibility filters reset. Individual Pool exclusions were preserved.')
  }

  const randomize = (): void => {
    if (!dataset) return
    setError(null)
    const result = validateConstraints(constraints, finalOperatorPool)
    if (!result.valid) {
      setError(result.errors.join(' '))
      return
    }

    try {
      setSquad(generateSquad(finalOperatorPool, constraints))
      setMessage(`Generated a squad of ${constraints.squadSize} operators.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const checkUpdates = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.desktop.checkOperatorUpdates()
      setUpdateCheck(result)
      setMessage(result.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const installUpdate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.desktop.updateOperatorData()
      await loadData()
      setUpdateCheck(null)
      setSquad([])
      setMessage(
        result.updated
          ? `Operator data updated. ${result.warnings.length ? `${result.warnings.length} metadata/image warning(s).` : ''}`
          : 'Operator data was already current.',
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ARKNIGHTS • OFFLINE SQUAD RANDOMIZER</p>
          <h1>Arknights Randomizer</h1>
        </div>
        <div className="data-summary">
          <span>{dataInfo?.operatorCount ?? '—'} operators</span>
          <span>Data {displayDate(dataInfo?.generatedAt)}</span>
          <span>{dataInfo?.origin === 'downloaded' ? 'Updated data' : 'Bundled data'}</span>
        </div>
      </header>

      <nav className="main-tabs" aria-label="Randomizer configuration">
        {(
          [
            ['squads', 'Squads'],
            ['operators', 'Operators'],
            ['pool', 'Pool'],
            ['options', 'Options'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'is-active' : ''}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'squads' && (
        <section className="panel squad-panel" aria-labelledby="squad-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SQUADS</p>
              <h2 id="squad-heading">Squad configuration</h2>
            </div>
            <div className="section-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={squad.length === 0 && !canMoveConstraints}
                onClick={squad.length > 0 ? clearSquad : moveConstraintsToTop}
              >
                {squad.length > 0 ? 'Clear Squad' : 'Move Constraints to Top'}
              </button>
              <button
                className="randomize-button"
                type="button"
                disabled={!dataset || !validation.valid}
                onClick={randomize}
              >
                {squad.length > 0 ? 'Randomize Again' : 'Randomize'}
              </button>
            </div>
          </div>

          <div className="preset-toolbar">
            <label className="preset-select">
              <span>Squad preset</span>
              <select
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
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </optgroup>
                {userPresets.length > 0 && (
                  <optgroup label="Saved">
                    {userPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
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
            </div>
          </div>

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
            {squad.length > 0 && <small>Clear the generated squad to change its size or slot constraints.</small>}
          </div>

          <div className="squad-bounds-layout">
            <fieldset className="constraint-group squad-bound-group">
              <legend>Rarity bounds</legend>
              <div className="bound-grid">
                {[...operatorRarities].reverse().map((rarity) => (
                  <BoundPill
                    key={rarity}
                    label={`${rarity}★`}
                    value={constraints.rarity[rarity]}
                    disabled={squad.length > 0}
                    onSave={(next) => saveRarityBound(rarity, next)}
                  />
                ))}
              </div>
              <div className="aggregate-bound-heading">
                <span>Aggregate rarity groups</span>
                <small>Counts overlap exact rarity bounds and are solved together.</small>
              </div>
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

            <fieldset className="constraint-group squad-bound-group">
              <legend>Class bounds</legend>
              <div className="bound-grid bound-grid--classes">
                {operatorClasses.map((operatorClass) => (
                  <BoundPill
                    key={operatorClass}
                    label={
                      <span className="bound-class-label">
                        <ClassIcon operatorClass={operatorClass} className="filter-class-icon" />
                        <span>{operatorClass}</span>
                      </span>
                    }
                    labelText={operatorClass}
                    value={constraints.class[operatorClass]}
                    disabled={squad.length > 0}
                    onSave={(next) => saveClassBound(operatorClass, next)}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="squad-grid-heading">
            <div>
              <strong>Operator slots</strong>
              <span>Click an empty in-range slot to configure allowed rarity and class sets.</span>
            </div>
          </div>

          <div className="squad-grid">
            {slots.map((slot, index) => {
              const operator = squad[index]
              const inRange = index < constraints.squadSize
              const slotConstraint = constraints.slots[index] ?? createEmptySlotConstraint()
              const constrained = !slotConstraintIsEmpty(slotConstraint)
              return (
                <div
                  className={`squad-slot${!inRange ? ' squad-slot--disabled' : ''}`}
                  key={slot}
                >
                  {!inRange ? (
                    <div className="disabled-slot" aria-label={`Squad slot ${slot} unavailable`}>
                      <strong>SLOT {slot}</strong>
                      <span>Unavailable</span>
                      <small>Squad size {constraints.squadSize}</small>
                    </div>
                  ) : operator ? (
                    <>
                      <OperatorCard operator={operator} />
                      {constrained && (
                        <div className="slot-constraint-badge" title="Generated under a slot constraint">
                          <span>{raritySetSummary(slotConstraint.rarities)}</span>
                          <span>{classSetSummary(slotConstraint.classes)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`slot-config-card${constrained ? ' is-constrained' : ''}`}
                      aria-label={`Configure squad slot ${slot}`}
                      onClick={() => setEditingSlot(index)}
                    >
                      <span className="slot-config-number">SLOT {slot}</span>
                      {constrained ? (
                        <span className="slot-config-summary">
                          <strong>{raritySetSummary(slotConstraint.rarities)}</strong>
                          <span>{classSetSummary(slotConstraint.classes)}</span>
                        </span>
                      ) : (
                        <span className="slot-config-any">
                          <strong>Any</strong>
                          <span>Click to configure</span>
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {dataset && !validation.valid && validation.errors.length > 0 && (
            <ValidationBox errors={validation.errors} />
          )}
        </section>
      )}

      {activeTab === 'operators' && (
        <section className="panel operators-panel" aria-labelledby="operators-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OPERATORS</p>
              <h2 id="operators-heading">Eligibility filters</h2>
            </div>
            <div className="section-actions">
              <button className="secondary-button" type="button" onClick={resetOperatorFilters}>
                Reset operator filters
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !dataset}
                onClick={() => void checkUpdates()}
              >
                {busy ? 'Working…' : 'Check data updates'}
              </button>
            </div>
          </div>

          <fieldset className="constraint-group detail-group release-group">
            <legend>Release</legend>
            <div className="release-bounds-grid">
              <div className="release-bound-card">
                <h3>Minimum bound</h3>
                <label className="field">
                  <span>Release group</span>
                  <select
                    value={releaseGroupSelectValue(
                      constraints.release.minYear,
                      constraints.release.minDate,
                    )}
                    onChange={(event) => changeReleaseGroup('min', event.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="custom" disabled>Custom</option>
                    {releaseYearOptions.map((year) => (
                      <option key={year} value={year}>{releaseGroupLabel(year)}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Exact date floor</span>
                  <input
                    className="date-input"
                    type="date"
                    value={constraints.release.minDate}
                    onChange={(event) => changeReleaseDate('min', event.target.value)}
                  />
                </label>
                <ReleasePreviewStrip label="Starts at event" preview={minReleasePreview} />
              </div>

              <div className="release-bound-card">
                <h3>Maximum bound</h3>
                <label className="field">
                  <span>Release group</span>
                  <select
                    value={releaseGroupSelectValue(
                      constraints.release.maxYear,
                      constraints.release.maxDate,
                    )}
                    onChange={(event) => changeReleaseGroup('max', event.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="custom" disabled>Custom</option>
                    {releaseYearOptions.map((year) => (
                      <option key={year} value={year}>{releaseGroupLabel(year)}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Exact date ceiling</span>
                  <input
                    className="date-input"
                    type="date"
                    value={constraints.release.maxDate}
                    onChange={(event) => changeReleaseDate('max', event.target.value)}
                  />
                </label>
                <ReleasePreviewStrip label="Ends at event" preview={maxReleasePreview} />
              </div>
            </div>
            <p className="filter-note">
              Portraits come only from the exact operator-release event at each bound. Launch is launch day only; Year 1 starts immediately after launch and later groups increment at anniversary release boundaries. Named groups prefill their exact regional date bounds; manually editing a date changes that side to Custom. Region comes from Options.
            </p>
          </fieldset>

          {dataset && (
            <Iteration6OperatorFilters
              dataset={dataset}
              constraints={constraints}
              onChange={mutateOperatorFilters}
            />
          )}

          <div className="source-filter-layout">
            <fieldset className="constraint-group detail-group source-filter-group">
              <legend>Acquisition</legend>
              <TreeGroup
                label="Limited"
                checked={limitedState.all}
                indeterminate={!limitedState.all && limitedState.some}
                onChange={setLimitedAll}
              >
                {limitedAcquisitionGroups.map((group) => (
                  <TriStateCheckbox
                    key={group}
                    label={limitedLabels[group]}
                    checked={constraints.acquisition.limited[group]}
                    onChange={(checked) =>
                      mutateOperatorFilters((current) => ({
                        ...current,
                        acquisition: {
                          ...current.acquisition,
                          limited: { ...current.acquisition.limited, [group]: checked },
                        },
                      }))
                    }
                  />
                ))}
              </TreeGroup>

              <div className="source-standalone">
                <TriStateCheckbox
                  label={<strong>Standard</strong>}
                  checked={constraints.acquisition.standard}
                  onChange={(checked) =>
                    mutateOperatorFilters((current) => ({
                      ...current,
                      acquisition: { ...current.acquisition, standard: checked },
                    }))
                  }
                />
              </div>

              <TreeGroup
                label="Welfare"
                checked={welfareState.all}
                indeterminate={!welfareState.all && welfareState.some}
                onChange={setWelfareAll}
              >
                {welfareAcquisitionGroups.map((group) => (
                  <TriStateCheckbox
                    key={group}
                    label={welfareLabels[group]}
                    checked={constraints.acquisition.welfare[group]}
                    onChange={(checked) =>
                      mutateOperatorFilters((current) => ({
                        ...current,
                        acquisition: {
                          ...current.acquisition,
                          welfare: { ...current.acquisition.welfare, [group]: checked },
                        },
                      }))
                    }
                  />
                ))}
              </TreeGroup>
            </fieldset>

            <fieldset className="constraint-group detail-group source-filter-group">
              <legend>Collaboration source</legend>
              <TreeGroup
                label="Collaboration pool"
                checked={collaborationState.all}
                indeterminate={!collaborationState.all && collaborationState.some}
                onChange={setCollaborationAll}
              >
                <TriStateCheckbox
                  label="Non-collab"
                  checked={constraints.collaboration.includeNonCollab}
                  onChange={(checked) =>
                    mutateOperatorFilters((current) => ({
                      ...current,
                      collaboration: { ...current.collaboration, includeNonCollab: checked },
                    }))
                  }
                />
                {collaborationSources.map((source) => (
                  <TriStateCheckbox
                    key={source}
                    label={source}
                    checked={constraints.collaboration.sources[source] ?? true}
                    onChange={(checked) =>
                      mutateOperatorFilters((current) => ({
                        ...current,
                        collaboration: {
                          ...current.collaboration,
                          sources: { ...current.collaboration.sources, [source]: checked },
                        },
                      }))
                    }
                  />
                ))}
              </TreeGroup>
              <p className="filter-note">
                Collab gacha counts as Limited → Collab; collab welfare counts as Welfare → Event / Story. This section independently controls which crossover sources may enter the pool.
              </p>
            </fieldset>
          </div>

          <fieldset className="constraint-group detail-group special-rules-group">
            <legend>Special rules</legend>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={constraints.alterExclusivity}
                onChange={(event) =>
                  mutateOperatorFilters((current) => ({
                    ...current,
                    alterExclusivity: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Alter Exclusivity</strong>
                <small>Allow only one version from each character family.</small>
              </span>
            </label>
            <p className="filter-note">
              Amiya (Caster), Amiya (Guard), and Amiya (Medic) are always mutually exclusive, regardless of this toggle.
            </p>
          </fieldset>

          {dataset && !validation.valid && validation.errors.length > 0 && (
            <ValidationBox errors={validation.errors} />
          )}

          {updateCheck?.updateAvailable && (
            <div className="update-box">
              <span>New operator data is available.</span>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void installUpdate()}
              >
                Update data
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'pool' && dataset && (
        <PoolPanel
          dataset={dataset}
          constraints={constraints}
          preferences={operatorPreferences}
          onPreferencesChange={updatePoolPreferences}
        />
      )}

      {activeTab === 'options' && (
        <OptionsPanel
          preferences={operatorPreferences}
          onMetadataRegionChange={setMetadataRegion}
          onPoolPresentationChange={setPoolPresentation}
        />
      )}

      <footer className="status-line">
        <span>{message}</span>
        {error && <span className="status-error">{error}</span>}
      </footer>

      {editingSlot !== null && dataset && squad.length === 0 && editingSlot < constraints.squadSize && (
        <SquadConstraintEditor
          slotIndex={editingSlot}
          value={constraints.slots[editingSlot] ?? createEmptySlotConstraint()}
          constraints={constraints}
          operators={finalOperatorPool}
          onApply={(value) => saveSlotConstraint(editingSlot, value)}
          onClose={() => setEditingSlot(null)}
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
    </main>
  )
}
