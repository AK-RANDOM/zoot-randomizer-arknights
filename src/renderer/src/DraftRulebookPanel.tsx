import { useEffect, useMemo, useState } from 'react'
import { operatorRarities, type OperatorDataset } from '../../shared/operator'
import type { DraftPullDistribution } from '../../shared/draftDistribution'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  createEmptyDraftRulebookEligibility,
  deserializeDraftRulebook,
  resolveDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { getDraftRulebookOperatorCostBreakdown } from '../../shared/draftRulebookCost'
import OperatorCard from './OperatorCard'
import {
  createLocalDraftRulebook,
  loadDraftRulebookLibrary,
  saveDraftRulebookLibrary,
} from './draftRulebookStorage'
import './DraftRulebookPanel.css'

interface DraftRulebookPanelProps {
  dataset: OperatorDataset
}

function cloneRulebook(rulebook: DraftRulebook): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(rulebook))
}

function defaultCustomDistribution(): DraftPullDistribution {
  return {
    type: 'custom',
    buckets: [
      { id: 'bucket-3', weight: 40, rarities: [3] },
      { id: 'bucket-4', weight: 50, rarities: [2, 4] },
      { id: 'bucket-5', weight: 8, rarities: [1, 5] },
      { id: 'bucket-6', weight: 2, rarities: [6] },
    ],
  }
}

function distributionType(rulebook: DraftRulebook): DraftPullDistribution['type'] {
  return rulebook.generalRules.pullDistribution?.type ?? 'equal'
}

function selectorCount(rulebook: DraftRulebook): number {
  if (rulebook.pool.source === 'inherit-global') return 0
  const eligibility = rulebook.pool.eligibility
  return eligibility.allOf.length + eligibility.anyOf.length + eligibility.noneOf.length
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export default function DraftRulebookPanel({ dataset }: DraftRulebookPanelProps): React.JSX.Element {
  const [customRulebooks, setCustomRulebooks] = useState<DraftRulebook[]>(() => loadDraftRulebookLibrary())
  const [selectedId, setSelectedId] = useState(STANDARD_DRAFT_RULEBOOK_ID)
  const [overrideOperatorId, setOverrideOperatorId] = useState('')
  const [overrideCost, setOverrideCost] = useState('')

  useEffect(() => saveDraftRulebookLibrary(customRulebooks), [customRulebooks])

  const rulebooks = useMemo(
    () => [STANDARD_DRAFT_RULEBOOK, ...customRulebooks],
    [customRulebooks],
  )
  const selected = rulebooks.find((rulebook) => rulebook.identifier.id === selectedId)
    ?? STANDARD_DRAFT_RULEBOOK
  const builtIn = selected.identifier.id === STANDARD_DRAFT_RULEBOOK_ID
  const validation = useMemo(() => validateDraftRulebook(selected), [selected])
  const resolved = useMemo(() => {
    if (!validation.valid) return null
    try {
      return resolveDraftRulebook(selected)
    } catch {
      return null
    }
  }, [selected, validation.valid])

  const sortedOperators = useMemo(
    () => [...dataset.operators].sort((left, right) => left.name.localeCompare(right.name)),
    [dataset.operators],
  )
  const operatorById = useMemo(
    () => new Map(dataset.operators.map((operator) => [operator.id, operator])),
    [dataset.operators],
  )
  const overrideIds = useMemo(
    () => Object.keys(selected.overrides.operatorCosts).sort((left, right) => {
      const leftName = operatorById.get(left)?.name ?? left
      const rightName = operatorById.get(right)?.name ?? right
      return leftName.localeCompare(rightName)
    }),
    [operatorById, selected.overrides.operatorCosts],
  )

  const updateSelected = (mutate: (draft: DraftRulebook) => void): void => {
    if (builtIn) return
    setCustomRulebooks((current) => current.map((rulebook) => {
      if (rulebook.identifier.id !== selected.identifier.id) return rulebook
      const next = cloneRulebook(rulebook)
      mutate(next)
      return next
    }))
  }

  const createNew = (): void => {
    const next = createLocalDraftRulebook()
    setCustomRulebooks((current) => [...current, next])
    setSelectedId(next.identifier.id)
  }

  const duplicateSelected = (): void => {
    const next = createLocalDraftRulebook(selected)
    setCustomRulebooks((current) => [...current, next])
    setSelectedId(next.identifier.id)
  }

  const deleteSelected = (): void => {
    if (builtIn) return
    if (!window.confirm(`Delete Draft Rulebook “${selected.identifier.name}”?`)) return
    setCustomRulebooks((current) => current.filter((rulebook) => rulebook.identifier.id !== selected.identifier.id))
    setSelectedId(STANDARD_DRAFT_RULEBOOK_ID)
  }

  const setPoolSource = (source: DraftRulebook['pool']['source']): void => {
    updateSelected((draft) => {
      if (source === 'inherit-global') {
        draft.pool = { source }
        return
      }
      const eligibility = draft.pool.source === 'inherit-global'
        ? createEmptyDraftRulebookEligibility()
        : draft.pool.eligibility
      draft.pool = { source, eligibility }
    })
  }

  const setDistribution = (type: DraftPullDistribution['type']): void => {
    updateSelected((draft) => {
      if (type === 'equal') draft.generalRules.pullDistribution = { type: 'equal' }
      else if (type === 'arknights') draft.generalRules.pullDistribution = { type: 'arknights' }
      else draft.generalRules.pullDistribution = defaultCustomDistribution()
    })
  }

  const setCustomBucketWeight = (bucketId: string, weight: number): void => {
    if (!Number.isFinite(weight) || weight < 0) return
    updateSelected((draft) => {
      const distribution = draft.generalRules.pullDistribution
      if (distribution?.type !== 'custom') return
      distribution.buckets = distribution.buckets.map((bucket) =>
        bucket.id === bucketId ? { ...bucket, weight } : bucket,
      )
    })
  }

  const economy = resolved?.configuration.economyRules
  const capacity = resolved?.configuration.capacityRules
  const selectedOverrideOperator = operatorById.get(overrideOperatorId)

  const chooseOverrideOperator = (operatorId: string): void => {
    setOverrideOperatorId(operatorId)
    if (!operatorId) {
      setOverrideCost('')
      return
    }
    const operator = operatorById.get(operatorId)
    if (!operator) return
    const existing = selected.overrides.operatorCosts[operatorId]
    const baseline = existing ?? getDraftRulebookOperatorCostBreakdown(selected, operator).rarityCost
    setOverrideCost(String(baseline))
  }

  const saveOverride = (): void => {
    if (!selectedOverrideOperator || builtIn) return
    const value = Number(overrideCost)
    if (!Number.isFinite(value)) return
    updateSelected((draft) => {
      draft.overrides.operatorCosts[selectedOverrideOperator.id] = value
    })
  }

  const removeOverride = (operatorId: string): void => {
    updateSelected((draft) => {
      delete draft.overrides.operatorCosts[operatorId]
    })
  }

  return (
    <section className="panel rulebook-panel" aria-labelledby="rulebook-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SETUP • DRAFT RULEBOOKS</p>
          <h2 id="rulebook-heading">Draft Rulebooks</h2>
        </div>
        <div className="section-actions">
          <button type="button" className="secondary-button" onClick={createNew}>New</button>
          <button type="button" className="secondary-button" onClick={duplicateSelected}>Duplicate</button>
          <button type="button" className="secondary-button" disabled={builtIn} onClick={deleteSelected}>Delete</button>
        </div>
      </div>

      <div className="rulebook-library-toolbar">
        <label className="field">
          <span>Rulebook</span>
          <select value={selected.identifier.id} onChange={(event) => setSelectedId(event.target.value)}>
            <optgroup label="Built-in">
              <option value={STANDARD_DRAFT_RULEBOOK_ID}>{STANDARD_DRAFT_RULEBOOK.identifier.name}</option>
            </optgroup>
            {customRulebooks.length > 0 && (
              <optgroup label="Local">
                {customRulebooks.map((rulebook) => (
                  <option key={rulebook.identifier.id} value={rulebook.identifier.id}>{rulebook.identifier.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <div className="rulebook-library-summary">
          <strong>{builtIn ? 'Built-in • read-only' : 'Local Rulebook'}</strong>
          <span>Revision {selected.identifier.revision}</span>
          <span>{selectorCount(selected)} pool selector{selectorCount(selected) === 1 ? '' : 's'}</span>
          <span>{overrideIds.length} override{overrideIds.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {!validation.valid && (
        <div className="validation-box" role="alert">
          <strong>Rulebook needs attention</strong>
          <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      <div className="rulebook-editor-grid">
        <fieldset className="constraint-group rulebook-editor-section">
          <legend>Identifier</legend>
          <label className="field">
            <span>Name</span>
            <input disabled={builtIn} value={selected.identifier.name} onChange={(event) => updateSelected((draft) => { draft.identifier.name = event.target.value })} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea disabled={builtIn} rows={3} value={selected.identifier.description} onChange={(event) => updateSelected((draft) => { draft.identifier.description = event.target.value })} />
          </label>
          <div className="rulebook-inline-fields">
            <label className="field">
              <span>Revision</span>
              <input disabled={builtIn} value={selected.identifier.revision} onChange={(event) => updateSelected((draft) => { draft.identifier.revision = event.target.value })} />
            </label>
            <label className="field">
              <span>Created</span>
              <input readOnly value={selected.identifier.createdAt} />
            </label>
          </div>
          <small className="filter-note">Schema version and author-facing revision are intentionally separate. Built-ins are read-only but can be duplicated.</small>
        </fieldset>

        <fieldset className="constraint-group rulebook-editor-section">
          <legend>General Rules</legend>
          <div className="rulebook-inline-fields">
            <label className="field">
              <span>Choices per offer</span>
              <input type="number" value={selected.generalRules.offerSize} readOnly />
            </label>
            <label className="field">
              <span>Starting points</span>
              <input
                type="number"
                disabled={builtIn}
                value={economy?.startingPoints ?? selected.generalRules.economyRules?.startingPoints ?? 0}
                onChange={(event) => updateSelected((draft) => {
                  draft.generalRules.economyRules = { ...draft.generalRules.economyRules, startingPoints: Number(event.target.value) }
                })}
              />
            </label>
          </div>
          <label className="rulebook-toggle">
            <input
              type="checkbox"
              disabled={builtIn}
              checked={economy?.enabled ?? selected.generalRules.economyRules?.enabled ?? false}
              onChange={(event) => updateSelected((draft) => {
                draft.generalRules.economyRules = { ...draft.generalRules.economyRules, enabled: event.target.checked }
              })}
            />
            <span>Enable point economy</span>
          </label>
          <label className="rulebook-toggle">
            <input
              type="checkbox"
              disabled={builtIn}
              checked={capacity?.enabled ?? selected.generalRules.capacityRules?.enabled ?? false}
              onChange={(event) => updateSelected((draft) => {
                draft.generalRules.capacityRules = { ...draft.generalRules.capacityRules, enabled: event.target.checked }
              })}
            />
            <span>Enable capacity rules</span>
          </label>
          <div className="rulebook-inline-fields rulebook-inline-fields--three">
            <label className="field"><span>Starting active</span><input type="number" min={1} disabled={builtIn} value={capacity?.startingActiveSlots ?? 6} onChange={(event) => updateSelected((draft) => { draft.generalRules.capacityRules = { ...draft.generalRules.capacityRules, startingActiveSlots: Number(event.target.value) } })} /></label>
            <label className="field"><span>Overflow</span><input type="number" min={0} disabled={builtIn} value={capacity?.overflowSlots ?? 1} onChange={(event) => updateSelected((draft) => { draft.generalRules.capacityRules = { ...draft.generalRules.capacityRules, overflowSlots: Number(event.target.value) } })} /></label>
            <label className="field"><span>Max active</span><input type="number" min={1} disabled={builtIn} value={capacity?.maxActiveSlots ?? 12} onChange={(event) => updateSelected((draft) => { draft.generalRules.capacityRules = { ...draft.generalRules.capacityRules, maxActiveSlots: Number(event.target.value) } })} /></label>
          </div>
          <small className="filter-note">Advanced Reroll / Hold / Forfeit / Slot Expansion authoring remains a later UI slice; existing imported values are preserved.</small>
        </fieldset>

        <fieldset className="constraint-group rulebook-editor-section">
          <legend>Pool</legend>
          <label className="field">
            <span>Pool Source</span>
            <select disabled={builtIn} value={selected.pool.source} onChange={(event) => setPoolSource(event.target.value as DraftRulebook['pool']['source'])}>
              <option value="inherit-global">Inherit Global Pool</option>
              <option value="global-restrictions">Global Pool + Rulebook Restrictions</option>
              <option value="rulebook-pool">Rulebook Pool</option>
            </select>
          </label>
          <p className="filter-note">
            {selected.pool.source === 'inherit-global'
              ? 'Uses the current app-wide Global Pool exactly.'
              : selected.pool.source === 'global-restrictions'
                ? 'Rulebook eligibility can only remove operators from the Global Pool.'
                : 'Rulebook eligibility resolves from the installed dataset and ignores Global Pool exclusions.'}
          </p>
          {selected.pool.source !== 'inherit-global' && (
            <div className="rulebook-placeholder-box">
              <strong>{selectorCount(selected)} selector{selectorCount(selected) === 1 ? '' : 's'} preserved</strong>
              <span>Full selector authoring will reuse the Global Pool browser patterns in a later pass. This basic editor can switch Pool Source without destroying imported selectors.</span>
            </div>
          )}
        </fieldset>

        <fieldset className="constraint-group rulebook-editor-section">
          <legend>Pull Distribution</legend>
          <label className="field">
            <span>Mode</span>
            <select disabled={builtIn} value={distributionType(selected)} onChange={(event) => setDistribution(event.target.value as DraftPullDistribution['type'])}>
              <option value="equal">Equal Opportunity</option>
              <option value="arknights">Arknights Headhunting</option>
              <option value="custom">Custom Distribution</option>
            </select>
          </label>
          {distributionType(selected) === 'arknights' && <p className="filter-note">Uses the locked Arknights bucket rates and pity behavior. Rate-up authoring is deferred.</p>}
          {selected.generalRules.pullDistribution?.type === 'custom' && (
            <div className="rulebook-bucket-grid">
              {selected.generalRules.pullDistribution.buckets.map((bucket) => (
                <label className="field rulebook-bucket" key={bucket.id}>
                  <span>{bucket.id} • {bucket.rarities.map((rarity) => `${rarity}★`).join(', ') || 'empty'}</span>
                  <input type="number" min={0} step={1} disabled={builtIn} value={bucket.weight} onChange={(event) => setCustomBucketWeight(bucket.id, Number(event.target.value))} />
                </label>
              ))}
              <small className="filter-note">This first editor supports custom bucket weights while preserving bucket membership. Full bucket/rate-up authoring follows later.</small>
            </div>
          )}
        </fieldset>
      </div>

      <fieldset className="constraint-group rulebook-editor-section rulebook-overrides-section">
        <legend>Overrides</legend>
        <div className="rulebook-override-adder">
          <label className="field">
            <span>Operator</span>
            <select disabled={builtIn} value={overrideOperatorId} onChange={(event) => chooseOverrideOperator(event.target.value)}>
              <option value="">Choose operator…</option>
              {sortedOperators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} ({operator.rarity}★)</option>)}
            </select>
          </label>
          <label className="field">
            <span>Baseline cost</span>
            <input type="number" disabled={builtIn || !overrideOperatorId} value={overrideCost} onChange={(event) => setOverrideCost(event.target.value)} />
          </label>
          <button type="button" className="secondary-button" disabled={builtIn || !overrideOperatorId || !Number.isFinite(Number(overrideCost))} onClick={saveOverride}>Add / Update</button>
        </div>

        {overrideIds.length === 0 ? (
          <p className="filter-note">No operator overrides. Operators inherit their rarity baseline.</p>
        ) : (
          <div className="rulebook-override-grid">
            {overrideIds.map((operatorId) => {
              const operator = operatorById.get(operatorId)
              const storedCost = selected.overrides.operatorCosts[operatorId]
              if (!operator) {
                return (
                  <article className="rulebook-unresolved-override" key={operatorId}>
                    <strong>{operatorId}</strong>
                    <span>Unresolved operator reference • baseline {storedCost}</span>
                    {!builtIn && <button type="button" className="secondary-button" onClick={() => removeOverride(operatorId)}>Remove</button>}
                  </article>
                )
              }
              const cost = getDraftRulebookOperatorCostBreakdown(selected, operator)
              return (
                <div className="rulebook-override-card" key={operatorId}>
                  <OperatorCard operator={operator} />
                  <div className="rulebook-override-meta">
                    <span>Default rarity cost <strong>{cost.rarityCost}</strong></span>
                    <span>Override <strong>{signed(cost.overrideDelta)}</strong></span>
                    <span>Baseline <strong>{cost.baselineCost}</strong></span>
                    {!builtIn && <button type="button" className="secondary-button" onClick={() => removeOverride(operatorId)}>Remove</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </fieldset>
    </section>
  )
}
