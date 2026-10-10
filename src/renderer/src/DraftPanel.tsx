import { useEffect, useMemo, useState } from 'react'
import type { DraftConfigurationInput } from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import {
  BUILT_IN_DRAFT_RULEBOOKS,
  STANDARD_DRAFT_RULEBOOK,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { resolveDraftRulebookExecution } from '../../shared/draftRulebookExecution'
import {
  BUILT_IN_DRAFT_PRICING_PROFILES,
  type DraftPricingProfile,
} from '../../shared/draftPricingProfile'
import DraftSessionView from './DraftSessionView'
import { loadDraftRulebookEntries } from './draftRulebookStorage'
import { loadCustomDraftPricingProfiles } from './draftPricingProfileStorage'
import { loadSelectedDraftRulebookId, saveSelectedDraftRulebookId } from './rendererPersistence'
import useDraftSession, { DRAFT_SESSION_RESET_EVENT } from './useDraftSession'

interface DraftPanelProps {
  dataset: OperatorDataset | null
  operators: readonly Operator[]
  targetSize: number
  ready: boolean
  onActiveDraftChange?: (active: boolean) => void
}

function ConfiguredRulebookDraft({
  rulebook,
  dataset,
  globalPool,
  targetSize,
  ready,
  pricingProfiles,
  rulebookControl,
  onActiveDraftChange,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset | null
  globalPool: readonly Operator[]
  targetSize: number
  ready: boolean
  pricingProfiles: readonly DraftPricingProfile[]
  rulebookControl?: React.ReactNode
  onActiveDraftChange?: (active: boolean) => void
}): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const execution = useMemo(
    () =>
      dataset
        ? resolveDraftRulebookExecution(rulebook, dataset.operators, globalPool, pricingProfiles)
        : null,
    [dataset, globalPool, pricingProfiles, rulebook],
  )
  const configuration = execution?.configuration ?? undefined
  const session = useDraftSession({
    pool: execution?.pool ?? [],
    targetSize,
    ready: ready && dataset !== null && execution?.valid === true,
    configuration: configuration as DraftConfigurationInput | undefined,
    sessionKey: execution?.identityKey ?? `${rulebook.identifier.id}:loading`,
    onMessage: setMessage,
    onError: setError,
  })

  useEffect(() => {
    onActiveDraftChange?.(session.state?.status === 'active')
    return () => onActiveDraftChange?.(false)
  }, [onActiveDraftChange, session.state?.status])

  return (
    <DraftSessionView
      state={session.state}
      operators={execution?.pool ?? []}
      targetSize={targetSize}
      ready={ready && dataset !== null}
      distributionLabel={session.distributionLabel}
      rulebook={rulebook}
      poolSourceLabel={execution?.poolSourceLabel ?? 'Resolving…'}
      dataset={dataset ?? undefined}
      configuration={configuration}
      validationErrors={execution?.validation.errors ?? []}
      statusMessage={message}
      statusError={error}
      onStart={session.start}
      onPick={session.pick}
      onAction={session.act}
      onAbandon={() => session.reset('Draft abandoned.')}
      rulebookControl={rulebookControl}
    />
  )
}

export default function DraftPanel({
  dataset,
  operators,
  targetSize,
  ready,
  onActiveDraftChange,
}: DraftPanelProps): React.JSX.Element {
  const customEntries = useMemo(() => loadDraftRulebookEntries(), [])
  const pricingProfiles = useMemo(
    () => [...BUILT_IN_DRAFT_PRICING_PROFILES, ...loadCustomDraftPricingProfiles()],
    [],
  )
  const customRulebooks = useMemo(
    () => customEntries.map((entry) => entry.document),
    [customEntries],
  )
  const importedEntries = useMemo(
    () => customEntries.filter((entry) => entry.origin === 'imported'),
    [customEntries],
  )
  const localEntries = useMemo(
    () => customEntries.filter((entry) => entry.origin === 'local'),
    [customEntries],
  )
  const rulebooks = useMemo(
    () => [...BUILT_IN_DRAFT_RULEBOOKS, ...customRulebooks],
    [customRulebooks],
  )
  const [selectedId, setSelectedId] = useState(() => loadSelectedDraftRulebookId())
  const [draftActive, setDraftActive] = useState(false)
  const selected =
    rulebooks.find((rulebook) => rulebook.identifier.id === selectedId) ?? STANDARD_DRAFT_RULEBOOK

  useEffect(() => {
    if (selected.identifier.id !== selectedId) {
      setSelectedId(selected.identifier.id)
      saveSelectedDraftRulebookId(selected.identifier.id)
    }
  }, [selected.identifier.id, selectedId])

  const selectRulebook = (rulebookId: string): void => {
    if (rulebookId === selected.identifier.id) return
    if (draftActive && !window.confirm('Changing Draft Rulebook will abandon the current Draft. Continue?')) return
    setSelectedId(rulebookId)
    saveSelectedDraftRulebookId(rulebookId)
    window.dispatchEvent(new Event(DRAFT_SESSION_RESET_EVENT))
  }

  const rulebookControl = (
    <select
      className="draft-rulebook-select"
      value={selected.identifier.id}
      aria-label="Draft Rulebook"
      onChange={(event) => selectRulebook(event.target.value)}
    >
      <optgroup label="Built-in">
        {BUILT_IN_DRAFT_RULEBOOKS.map((rulebook) => (
          <option key={rulebook.identifier.id} value={rulebook.identifier.id}>
            {rulebook.identifier.name}
          </option>
        ))}
      </optgroup>
      {importedEntries.length > 0 && (
        <optgroup label="Imported">
          {importedEntries.map((entry) => (
            <option key={entry.document.identifier.id} value={entry.document.identifier.id}>
              {entry.document.identifier.name}
            </option>
          ))}
        </optgroup>
      )}
      {localEntries.length > 0 && (
        <optgroup label="Local">
          {localEntries.map((entry) => (
            <option key={entry.document.identifier.id} value={entry.document.identifier.id}>
              {entry.document.identifier.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )

  const handleActiveDraftChange = (active: boolean): void => {
    setDraftActive(active)
    onActiveDraftChange?.(active)
  }

  return (
    <>
      <ConfiguredRulebookDraft
        key={selected.identifier.id}
        rulebook={selected}
        dataset={dataset}
        globalPool={operators}
        targetSize={targetSize}
        ready={ready}
        pricingProfiles={pricingProfiles}
        rulebookControl={rulebookControl}
        onActiveDraftChange={handleActiveDraftChange}
      />
    </>
  )
}
