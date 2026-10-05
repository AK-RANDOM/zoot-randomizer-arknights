import { useMemo, type ReactNode } from 'react'
import {
  DEFAULT_DRAFT_ACTION_RULES,
  DEFAULT_DRAFT_ECONOMY_RULES,
  resolveDraftConfiguration,
  type DraftHoldUpkeepRules,
  type DraftLimitedActionRules,
} from '../../shared/draft'
import { operatorRarities, type OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftRulebookDistributionEditor from './DraftRulebookDistributionEditor'
import {
  getRerollMode,
  parsePositiveLimit,
  type RerollMode,
} from './draftRulebookEditorUtils'

function LimitedActionEditor({
  label,
  description,
  rule,
  disabled,
  onChange,
  children,
}: {
  label: string
  description: string
  rule: DraftLimitedActionRules
  disabled: boolean
  onChange: (rule: DraftLimitedActionRules) => void
  children?: ReactNode
}): React.JSX.Element {
  return (
    <div className="rulebook-action-card">
      <label className="rulebook-toggle">
        <input
          type="checkbox"
          disabled={disabled}
          checked={rule.enabled}
          onChange={(event) => onChange({ ...rule, enabled: event.target.checked })}
        />
        <span><strong>{label}</strong> — {description}</span>
      </label>
      <div className="rulebook-inline-fields rulebook-inline-fields--three">
        <label className="field">
          <span>Per-round limit</span>
          <input type="number" min={1} placeholder="Unlimited" disabled={disabled || !rule.enabled} value={rule.perRoundLimit ?? ''} onChange={(event) => onChange({ ...rule, perRoundLimit: parsePositiveLimit(event.target.value) })} />
        </label>
        <label className="field">
          <span>Per-draft limit</span>
          <input type="number" min={1} placeholder="Unlimited" disabled={disabled || !rule.enabled} value={rule.perDraftLimit ?? ''} onChange={(event) => onChange({ ...rule, perDraftLimit: parsePositiveLimit(event.target.value) })} />
        </label>
        <label className="field">
          <span>Cooldown rounds</span>
          <input type="number" min={0} disabled={disabled || !rule.enabled} value={rule.cooldownRounds} onChange={(event) => onChange({ ...rule, cooldownRounds: Math.max(0, Number(event.target.value) || 0) })} />
        </label>
      </div>
      {children}
    </div>
  )
}

export default function DraftRulebookGeneralRulesEditor({
  rulebook,
  dataset,
  disabled,
  onChange,
}: {
  rulebook: DraftRulebook
  dataset: OperatorDataset
  disabled: boolean
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  const preview = useMemo(() => resolveDraftConfiguration({
    actionRules: rulebook.generalRules.actionRules,
    capacityRules: rulebook.generalRules.capacityRules,
    economyRules: {
      ...rulebook.generalRules.economyRules,
      operatorCostOverrides: rulebook.overrides.operatorCosts,
    },
    pullDistribution: rulebook.generalRules.pullDistribution,
  }), [rulebook])

  const economy = preview.economyRules
  const capacity = preview.capacityRules
  const actions = preview.actionRules
  const pullDistribution = rulebook.generalRules.pullDistribution ?? { type: 'equal' as const }

  const updateEconomy = (patch: Partial<NonNullable<DraftRulebook['generalRules']['economyRules']>>): void => onChange((draft) => {
    draft.generalRules.economyRules = { ...draft.generalRules.economyRules, ...patch }
  })
  const updateCapacity = (patch: Partial<NonNullable<DraftRulebook['generalRules']['capacityRules']>>): void => onChange((draft) => {
    draft.generalRules.capacityRules = { ...draft.generalRules.capacityRules, ...patch }
  })
  const updateHold = (patch: Partial<typeof actions.hold>): void => onChange((draft) => {
    draft.generalRules.actionRules = { ...draft.generalRules.actionRules, hold: { ...actions.hold, ...patch } }
  })
  const updateForfeit = (patch: Partial<typeof actions.forfeit>): void => onChange((draft) => {
    draft.generalRules.actionRules = { ...draft.generalRules.actionRules, forfeit: { ...actions.forfeit, ...patch } }
  })
  const updateReroll = (patch: Partial<typeof actions.reroll>): void => onChange((draft) => {
    draft.generalRules.actionRules = { ...draft.generalRules.actionRules, reroll: { ...actions.reroll, ...patch } }
  })
  const updateSlotExpansion = (patch: Partial<typeof actions.slotExpansion>): void => onChange((draft) => {
    draft.generalRules.actionRules = { ...draft.generalRules.actionRules, slotExpansion: { ...actions.slotExpansion, ...patch } }
  })

  const rarityCost = (rarity: (typeof operatorRarities)[number]): number =>
    rulebook.generalRules.economyRules?.rarityCosts?.[rarity] ??
    preview.economyRules.rarityCosts[rarity] ??
    DEFAULT_DRAFT_ECONOMY_RULES.rarityCosts[rarity] ??
    0

  const setRarityCost = (rarity: (typeof operatorRarities)[number], cost: number): void => {
    if (!Number.isFinite(cost)) return
    onChange((draft) => {
      draft.generalRules.economyRules = {
        ...draft.generalRules.economyRules,
        rarityCosts: { ...draft.generalRules.economyRules?.rarityCosts, [rarity]: cost },
      }
    })
  }

  const setHoldUpkeepMode = (mode: DraftHoldUpkeepRules['mode']): void => {
    const current = economy.holdUpkeep
    if (mode === 'none') {
      updateEconomy({ holdUpkeep: { mode: 'none' } })
      return
    }
    if (mode === 'static') {
      const cost = current.mode === 'static'
        ? current.cost
        : current.mode === 'escalating'
          ? current.baseCost
          : 0
      updateEconomy({ holdUpkeep: { mode: 'static', cost } })
      return
    }
    const baseCost = current.mode === 'escalating'
      ? current.baseCost
      : current.mode === 'static'
        ? current.cost
        : 0
    const escalation = current.mode === 'escalating' ? current.escalation : 0
    updateEconomy({ holdUpkeep: { mode: 'escalating', baseCost, escalation } })
  }

  const setRerollMode = (mode: RerollMode): void => {
    const current = actions.reroll
    if (mode === 'none') updateReroll({ enabled: false })
    else if (mode === 'per-round') updateReroll({ enabled: true, perRoundLimit: current.perRoundLimit ?? 1, perDraftLimit: null })
    else if (mode === 'per-draft') updateReroll({ enabled: true, perRoundLimit: null, perDraftLimit: current.perDraftLimit ?? 1 })
    else if (mode === 'unlimited') updateReroll({ enabled: true, perRoundLimit: null, perDraftLimit: null })
    else updateReroll({ enabled: true, perRoundLimit: current.perRoundLimit ?? 1, perDraftLimit: current.perDraftLimit ?? 1 })
  }

  return (
    <>
      <fieldset className="constraint-group rulebook-editor-section">
        <legend>General Rules</legend>
        <div className="rulebook-inline-fields">
          <label className="field">
            <span>Choices per offer</span>
            <input type="number" value={rulebook.generalRules.offerSize} readOnly />
          </label>
          <label className="field">
            <span>Starting points</span>
            <input type="number" disabled={disabled} value={economy.startingPoints} onChange={(event) => updateEconomy({ startingPoints: Number(event.target.value) })} />
          </label>
        </div>
        <label className="rulebook-toggle">
          <input type="checkbox" disabled={disabled} checked={economy.enabled} onChange={(event) => updateEconomy({ enabled: event.target.checked })} />
          <span>Enable point economy</span>
        </label>
        <div className="rulebook-rarity-cost-grid">
          {operatorRarities.map((rarity) => (
            <label className="field" key={rarity}>
              <span>{rarity}★ cost</span>
              <input type="number" disabled={disabled} value={rarityCost(rarity)} onChange={(event) => setRarityCost(rarity, Number(event.target.value))} />
            </label>
          ))}
        </div>
        <div className="rulebook-inline-fields rulebook-inline-fields--three">
          <label className="field"><span>Forfeit rebate</span><input type="number" disabled={disabled} value={economy.forfeitRebate} onChange={(event) => updateEconomy({ forfeitRebate: Number(event.target.value) })} /></label>
          <label className="field"><span>Reroll cost</span><input type="number" disabled={disabled} value={economy.rerollCost} onChange={(event) => updateEconomy({ rerollCost: Number(event.target.value) })} /></label>
          <label className="field"><span>Hold cost</span><input type="number" disabled={disabled} value={economy.holdCost} onChange={(event) => updateEconomy({ holdCost: Number(event.target.value) })} /></label>
        </div>
        <div className="rulebook-inline-fields rulebook-inline-fields--three">
          <label className="field">
            <span>Hold upkeep</span>
            <select disabled={disabled} value={economy.holdUpkeep.mode} onChange={(event) => setHoldUpkeepMode(event.target.value as DraftHoldUpkeepRules['mode'])}>
              <option value="none">None</option>
              <option value="static">Static</option>
              <option value="escalating">Escalating</option>
            </select>
          </label>
          {economy.holdUpkeep.mode === 'static' && (
            <label className="field">
              <span>Upkeep per round</span>
              <input type="number" min={0} disabled={disabled} value={economy.holdUpkeep.cost} onChange={(event) => updateEconomy({ holdUpkeep: { mode: 'static', cost: Math.max(0, Number(event.target.value) || 0) } })} />
            </label>
          )}
          {economy.holdUpkeep.mode === 'escalating' && (
            <>
              <label className="field">
                <span>Upkeep base</span>
                <input type="number" min={0} disabled={disabled} value={economy.holdUpkeep.baseCost} onChange={(event) => updateEconomy({ holdUpkeep: {
                  mode: 'escalating',
                  baseCost: Math.max(0, Number(event.target.value) || 0),
                  escalation: economy.holdUpkeep.mode === 'escalating' ? economy.holdUpkeep.escalation : 0,
                } })} />
              </label>
              <label className="field">
                <span>Increase per charge</span>
                <input type="number" min={0} disabled={disabled} value={economy.holdUpkeep.escalation} onChange={(event) => updateEconomy({ holdUpkeep: {
                  mode: 'escalating',
                  baseCost: economy.holdUpkeep.mode === 'escalating' ? economy.holdUpkeep.baseCost : 0,
                  escalation: Math.max(0, Number(event.target.value) || 0),
                } })} />
              </label>
            </>
          )}
        </div>
        {economy.holdUpkeep.mode !== 'none' && <small className="filter-note">Upkeep is charged when the held operator survives another completed round. Draft or release it during the current round to avoid the next charge.</small>}
        <label className="field"><span>Slot expansion cost</span><input type="number" disabled={disabled} value={economy.slotExpansionCost} onChange={(event) => updateEconomy({ slotExpansionCost: Number(event.target.value) })} /></label>
        <label className="rulebook-toggle">
          <input type="checkbox" disabled={disabled} checked={capacity.enabled} onChange={(event) => updateCapacity({ enabled: event.target.checked })} />
          <span>Enable capacity rules</span>
        </label>
        <div className="rulebook-inline-fields rulebook-inline-fields--three">
          <label className="field"><span>Starting active</span><input type="number" min={1} disabled={disabled} value={capacity.startingActiveSlots} onChange={(event) => updateCapacity({ startingActiveSlots: Number(event.target.value) })} /></label>
          <label className="field"><span>Overflow</span><input type="number" min={0} disabled={disabled} value={capacity.overflowSlots} onChange={(event) => updateCapacity({ overflowSlots: Number(event.target.value) })} /></label>
          <label className="field"><span>Max active</span><input type="number" min={1} disabled={disabled} value={capacity.maxActiveSlots} onChange={(event) => updateCapacity({ maxActiveSlots: Number(event.target.value) })} /></label>
        </div>
      </fieldset>

      <fieldset className="constraint-group rulebook-editor-section rulebook-wide-section">
        <legend>Advanced Actions</legend>
        <div className="rulebook-action-grid">
          <LimitedActionEditor label="Hold" description="consumes the round and stores one offered operator" rule={actions.hold} disabled={disabled} onChange={(rule) => updateHold(rule)}>
            <label className="rulebook-toggle"><input type="checkbox" disabled={disabled || !actions.hold.enabled} checked={actions.hold.discardUnheldOffer} onChange={(event) => updateHold({ discardUnheldOffer: event.target.checked })} /><span>Discard the other offered operators when Hold resolves</span></label>
          </LimitedActionEditor>
          <LimitedActionEditor label="Forfeit" description="consumes the round and gives up one usable capacity opportunity" rule={actions.forfeit} disabled={disabled} onChange={(rule) => updateForfeit(rule)}>
            <label className="rulebook-toggle"><input type="checkbox" disabled={disabled || !actions.forfeit.enabled} checked={actions.forfeit.discardOffer} onChange={(event) => updateForfeit({ discardOffer: event.target.checked })} /><span>Discard the forfeited offer from the draft pool</span></label>
          </LimitedActionEditor>
          <div className="rulebook-action-card">
            <div className="rulebook-editor-subheading"><div><strong>Reroll</strong><small>Non-turn-consuming. Replaces the current offer.</small></div></div>
            <label className="field">
              <span>Limit mode</span>
              <select disabled={disabled} value={getRerollMode(actions.reroll)} onChange={(event) => setRerollMode(event.target.value as RerollMode)}>
                <option value="none">None</option><option value="per-round">Per round</option><option value="per-draft">Per draft</option><option value="unlimited">Unlimited</option>
                {getRerollMode(actions.reroll) === 'advanced' && <option value="advanced">Advanced imported limits</option>}
              </select>
            </label>
            {actions.reroll.enabled && getRerollMode(actions.reroll) !== 'unlimited' && getRerollMode(actions.reroll) !== 'none' && (
              <div className="rulebook-inline-fields">
                {(getRerollMode(actions.reroll) === 'per-round' || getRerollMode(actions.reroll) === 'advanced') && <label className="field"><span>Per-round limit</span><input type="number" min={1} disabled={disabled} value={actions.reroll.perRoundLimit ?? ''} onChange={(event) => updateReroll({ perRoundLimit: parsePositiveLimit(event.target.value) })} /></label>}
                {(getRerollMode(actions.reroll) === 'per-draft' || getRerollMode(actions.reroll) === 'advanced') && <label className="field"><span>Per-draft limit</span><input type="number" min={1} disabled={disabled} value={actions.reroll.perDraftLimit ?? ''} onChange={(event) => updateReroll({ perDraftLimit: parsePositiveLimit(event.target.value) })} /></label>}
              </div>
            )}
            <label className="field"><span>Cooldown rounds</span><input type="number" min={0} disabled={disabled || !actions.reroll.enabled} value={actions.reroll.cooldownRounds} onChange={(event) => updateReroll({ cooldownRounds: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label className="rulebook-toggle"><input type="checkbox" disabled={disabled || !actions.reroll.enabled} checked={actions.reroll.discardOffer} onChange={(event) => updateReroll({ discardOffer: event.target.checked })} /><span>Discard rerolled operators from the draft pool</span></label>
          </div>
          <LimitedActionEditor label="Slot Expansion" description="non-turn-consuming capacity purchase" rule={actions.slotExpansion} disabled={disabled} onChange={(rule) => updateSlotExpansion(rule)}>
            <small className="filter-note">The built-in advanced default allows {DEFAULT_DRAFT_ACTION_RULES.slotExpansion.perRoundLimit} expansion per round.</small>
          </LimitedActionEditor>
        </div>
      </fieldset>

      <fieldset className="constraint-group rulebook-editor-section">
        <legend>Pull Distribution</legend>
        <DraftRulebookDistributionEditor
          dataset={dataset}
          distribution={pullDistribution}
          disabled={disabled}
          onChange={(distribution) => onChange((draft) => { draft.generalRules.pullDistribution = distribution })}
        />
      </fieldset>
    </>
  )
}
