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
  const [, setMessage] = useState<string | null>(null)
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
      rulebook={rulebook}
      dataset={dataset ?? undefined}
      configuration={configuration}
      validationErrors={execution?.validation.errors ?? []}
      statusError={error}
      onStart={session.start}
      onPick={session.pick}
      onAction={session.act}
      onFinalize={session.finalize}
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
  const [selectedId, setSelectedId] = useState(() => loadSelectedDraftRulebookId())
  const [draftActive, setDraftActive] = useState(false)
  const selected =
    BUILT_IN_DRAFT_RULEBOOKS.find((rulebook) => rulebook.identifier.id === selectedId) ??
    STANDARD_DRAFT_RULEBOOK

  const selectRulebook = (rulebookId: string): void => {
    if (rulebookId === selected.identifier.id) return
    if (
      draftActive &&
      !window.confirm('Changing Draft Rulebook will abandon the current Draft. Continue?')
    )
      return
    setSelectedId(rulebookId)
    saveSelectedDraftRulebookId(rulebookId)
    window.dispatchEvent(new Event(DRAFT_SESSION_RESET_EVENT))
  }

  const builtInOptions = BUILT_IN_DRAFT_RULEBOOKS.map((rulebook) => (
    <option key={rulebook.identifier.id} value={rulebook.identifier.id}>
      {rulebook.identifier.name}
    </option>
  ))
  const rulebookControl = (
    <select
      className="draft-rulebook-select"
      value={selected.identifier.id}
      aria-label="Draft Rulebook"
      onChange={(event) => selectRulebook(event.target.value)}
    >
      {builtInOptions}
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
        pricingProfiles={BUILT_IN_DRAFT_PRICING_PROFILES}
        rulebookControl={rulebookControl}
        onActiveDraftChange={handleActiveDraftChange}
      />
    </>
  )
}
