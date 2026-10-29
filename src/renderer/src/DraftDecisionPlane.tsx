import type { CSSProperties } from 'react'
import type {
  DraftAction,
  DraftLimitedActionRules,
  DraftState,
  ResolvedDraftConfiguration,
} from '../../shared/draft'
import type { Operator, OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import DraftOperatorCard from './DraftOperatorCard'
import { buildLiveRulebookOperatorInteractionDetails } from './draftInteractionPresentation'
import {
  resolveDraftActionPresentation,
  resolveDraftHoldPresentation,
  resolveDraftOperatorPresentation,
  type DraftActionPresentation,
  type DraftEconomyValuePresentation,
} from './draftPresentation'
import './DraftDecisionPlane.css'

const holdIconUrl = new URL('./assets/draft/hold-icon.png', import.meta.url).href
const forfeitIconUrl = new URL('./assets/draft/forfeit-icon.png', import.meta.url).href

interface DraftDecisionPlaneProps {
  state: DraftState
  operators: readonly Operator[]
  rulebook: DraftRulebook
  configuration: ResolvedDraftConfiguration
  dataset?: OperatorDataset
  onPick: (operatorId: string) => void
  onAction: (action: DraftAction) => void
}

function pointDeltaLabel(value: DraftEconomyValuePresentation): string {
  if (value.pointDelta === 0) return 'Free'
  return `${value.amount} pts`
}

function remainingLimitLabel(
  rules: DraftLimitedActionRules,
  usage: DraftState['actionUsage']['reroll'],
): string | null {
  const parts: string[] = []
  if (rules.perRoundLimit !== null)
    parts.push(`${Math.max(0, rules.perRoundLimit - usage.round)} this round`)
  if (rules.perDraftLimit !== null)
    parts.push(`${Math.max(0, rules.perDraftLimit - usage.total)} this draft`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function economyClass(value: DraftEconomyValuePresentation): string {
  return `draft-decision-economy draft-decision-economy--${value.tone}`
}

function DraftActionArtwork({ variant }: { variant: 'hold' | 'forfeit' }): React.JSX.Element {
  return (
    <img
      className="draft-action-artwork"
      src={variant === 'hold' ? holdIconUrl : forfeitIconUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

function ForfeitSurface({
  presentation,
  onForfeit,
}: {
  presentation: DraftActionPresentation
  onForfeit: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="draft-forfeit-surface"
      disabled={!presentation.available}
      title={presentation.blockReasonLabel ?? undefined}
      onClick={onForfeit}
    >
      <DraftActionArtwork variant="forfeit" />
      <span
        className={economyClass(presentation.economy)}
        aria-label={pointDeltaLabel(presentation.economy)}
      >
        {presentation.economy.amount}
      </span>
      <span className="draft-forfeit-surface__body">
        <strong>Forfeit</strong>
        <span>End this round without taking an operator.</span>
      </span>
    </button>
  )
}

export default function DraftDecisionPlane({
  state,
  operators,
  rulebook,
  configuration,
  dataset,
  onPick,
  onAction,
}: DraftDecisionPlaneProps): React.JSX.Element {
  const operatorById = new Map(operators.map((operator) => [operator.id, operator] as const))
  const offeredOperators = state.currentOfferIds
    .map((id) => operatorById.get(id))
    .filter((operator): operator is Operator => operator !== undefined)
  const heldOperator = state.heldOperatorId
    ? (operatorById.get(state.heldOperatorId) ?? null)
    : null
  const reroll = configuration.actionRules.reroll.enabled
    ? resolveDraftActionPresentation(state, operators, { type: 'reroll' }, configuration)
    : null
  const forfeit = configuration.actionRules.forfeit.enabled
    ? resolveDraftActionPresentation(state, operators, { type: 'forfeit' }, configuration)
    : null
  const releaseHold = heldOperator
    ? resolveDraftActionPresentation(state, operators, { type: 'release-hold' }, configuration)
    : null
  const holdPresentation = resolveDraftHoldPresentation(state, configuration)
  const rerollLimit = reroll
    ? remainingLimitLabel(configuration.actionRules.reroll, state.actionUsage.reroll)
    : null
  const sideCardCount = (configuration.actionRules.hold.enabled ? 1 : 0) + (forfeit ? 1 : 0)
  const offerCardCount = Math.max(1, offeredOperators.length)
  const stripCardCount = offerCardCount + sideCardCount
  const stripGap = 12
  const stripMaxWidth = stripCardCount * 174 + Math.max(0, stripCardCount - 1) * stripGap
  const planeStyle = {
    '--draft-strip-count': stripCardCount,
    maxWidth: `${stripMaxWidth}px`,
  } as CSSProperties
  const offersGroupStyle = { gridColumn: `span ${offerCardCount}` } satisfies CSSProperties
  const offerGridStyle = {
    gridTemplateColumns: `repeat(${offerCardCount}, minmax(0, 1fr))`,
  } satisfies CSSProperties
  const sideRailStyle =
    sideCardCount > 0
      ? ({
          gridColumn: `span ${sideCardCount}`,
          gridTemplateColumns: `repeat(${sideCardCount}, minmax(0, 1fr))`,
        } satisfies CSSProperties)
      : undefined

  return (
    <div className="draft-decision-plane" style={planeStyle} aria-label="Current Draft decision">
      <section
        className="draft-decision-group draft-decision-group--offers"
        aria-label="Current offers"
        style={offersGroupStyle}
      >
        <div className="draft-decision-offer-grid" style={offerGridStyle}>
          {offeredOperators.map((operator) => {
            const presentation = resolveDraftOperatorPresentation(
              state,
              operators,
              operator,
              configuration,
            )
            const interactionDetails = dataset
              ? buildLiveRulebookOperatorInteractionDetails(
                  rulebook,
                  operator,
                  dataset,
                  operators,
                  state,
                  configuration,
                )
              : undefined
            const holdAction = presentation.hold?.action
            return (
              <DraftOperatorCard
                key={operator.id}
                operator={operator}
                presentation={presentation}
                interactionDetails={interactionDetails}
                onPick={() => onPick(operator.id)}
                onHold={holdAction ? () => onAction(holdAction) : undefined}
              />
            )
          })}
        </div>
        {reroll && (
          <div className="draft-decision-control draft-decision-control--offers">
            <button
              type="button"
              className="secondary-button draft-decision-action"
              disabled={!reroll.available}
              title={reroll.blockReasonLabel ?? undefined}
              onClick={() => onAction(reroll.action)}
            >
              <strong>Reroll</strong>
              <span>
                {rerollLimit ? `${rerollLimit} · ` : ''}
                {pointDeltaLabel(reroll.economy)}
              </span>
            </button>
          </div>
        )}
      </section>
      {(configuration.actionRules.hold.enabled || forfeit) && (
        <div className="draft-decision-side-rail" style={sideRailStyle}>
          {configuration.actionRules.hold.enabled && (
            <section
              className="draft-decision-group draft-decision-group--held"
              aria-label="Held operator"
            >
              {heldOperator ? (
                <DraftOperatorCard
                  operator={heldOperator}
                  presentation={resolveDraftOperatorPresentation(
                    state,
                    operators,
                    heldOperator,
                    configuration,
                  )}
                  interactionDetails={
                    dataset
                      ? buildLiveRulebookOperatorInteractionDetails(
                          rulebook,
                          heldOperator,
                          dataset,
                          operators,
                          state,
                          configuration,
                        )
                      : undefined
                  }
                  currentUpkeep={holdPresentation?.currentUpkeep ?? null}
                  showHold={false}
                  onPick={() => onAction({ type: 'pick', operatorId: heldOperator.id })}
                  releasePresentation={releaseHold}
                  onRelease={releaseHold ? () => onAction(releaseHold.action) : undefined}
                />
              ) : (
                <div
                  className="draft-hold-surface draft-hold-surface--empty"
                  aria-label="Hold: empty"
                >
                  <DraftActionArtwork variant="hold" />
                  <span className="draft-hold-surface__body">
                    <span>Hold</span>
                    <strong>Empty</strong>
                  </span>
                </div>
              )}
            </section>
          )}
          {forfeit && (
            <section
              className="draft-decision-group draft-decision-group--forfeit"
              aria-label="Forfeit"
            >
              <ForfeitSurface presentation={forfeit} onForfeit={() => onAction(forfeit.action)} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
