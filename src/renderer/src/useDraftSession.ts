import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Operator } from '../../shared/operator'
import {
  STANDARD_DRAFT_CONFIGURATION,
  applyDraftAction,
  createDraftPoolKey,
  draftPullDistributionLabel,
  evaluateDraftAction,
  getDraftActionPointDelta,
  resolveDraftConfiguration,
  startDraft,
  type DraftAction,
  type DraftActionAvailability,
  type DraftConfigurationInput,
  type DraftOperatorCostResolver,
  type DraftState,
  type ResolvedDraftConfiguration,
} from '../../shared/draft'
import { draftCompletionMessage } from './draftSessionMessages'

export const DRAFT_SESSION_RESET_EVENT = 'arknights-randomizer:draft-session-reset'

interface UseDraftSessionOptions {
  pool: readonly Operator[]
  targetSize: number
  ready: boolean
  configuration?: DraftConfigurationInput
  operatorCostResolver?: DraftOperatorCostResolver
  sessionKey?: string
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}

export interface DraftSessionController {
  state: DraftState | null
  configuration: ResolvedDraftConfiguration
  distributionLabel: string
  start: () => void
  act: (action: DraftAction) => void
  pick: (operatorId: string) => void
  evaluate: (action: DraftAction) => DraftActionAvailability
  pointDelta: (action: DraftAction) => number
  reset: (message?: string) => void
}

const RESET_MESSAGE = 'Draft reset because the squad size, eligible pool, or Draft Rulebook changed.'

function actionMessage(action: DraftAction, after: DraftState, pool: readonly Operator[]): string {
  if (after.status === 'complete') return draftCompletionMessage(after)
  switch (action.type) {
    case 'pick': {
      const operator = pool.find((candidate) => candidate.id === action.operatorId)
      return `${operator?.name ?? 'Operator'} drafted. ${after.draftedOperatorIds.length} / ${after.targetSize} selected.`
    }
    case 'hold': {
      const operator = pool.find((candidate) => candidate.id === action.operatorId)
      return `${operator?.name ?? 'Operator'} moved to Hold. Round ${after.roundNumber} is ready.`
    }
    case 'release-hold': return 'Held operator released.'
    case 'forfeit': return `Round forfeited. ${after.points} point${after.points === 1 ? '' : 's'} available.`
    case 'reroll': return `Offer rerolled. Round ${after.roundNumber} remains active.`
    case 'slot-expansion': return `Active capacity expanded to ${after.activeCapacity}.`
  }
}

export default function useDraftSession({ pool, targetSize, ready, configuration, operatorCostResolver, sessionKey, onMessage, onError }: UseDraftSessionOptions): DraftSessionController {
  const [state, setState] = useState<DraftState | null>(null)
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null)
  const resolvedConfiguration = useMemo(() => resolveDraftConfiguration(configuration ?? STANDARD_DRAFT_CONFIGURATION), [configuration])
  const engineOptions = useMemo(() => ({ configuration: resolvedConfiguration, operatorCostResolver }), [operatorCostResolver, resolvedConfiguration])
  const poolKey = useMemo(() => createDraftPoolKey(pool, targetSize), [pool, targetSize])
  const identity = useMemo(() => `${poolKey}\n${sessionKey ?? JSON.stringify(resolvedConfiguration)}`, [poolKey, resolvedConfiguration, sessionKey])

  const reset = useCallback((message = RESET_MESSAGE): void => {
    setState(null)
    setActiveIdentity(null)
    onError(null)
    onMessage(message)
  }, [onError, onMessage])

  useEffect(() => { if (state && activeIdentity !== identity) reset() }, [activeIdentity, identity, reset, state])
  useEffect(() => { const listener = (): void => reset(); window.addEventListener(DRAFT_SESSION_RESET_EVENT, listener); return () => window.removeEventListener(DRAFT_SESSION_RESET_EVENT, listener) }, [reset])

  const start = useCallback((): void => {
    if (!ready) return
    onError(null)
    try {
      const next = startDraft(pool, targetSize, engineOptions)
      setState(next)
      setActiveIdentity(identity)
      onMessage(next.status === 'complete' ? draftCompletionMessage(next) : `Draft started. Pick 1 of 3 for a target roster of ${next.targetSize}.`)
    } catch (reason) { onError(reason instanceof Error ? reason.message : String(reason)) }
  }, [engineOptions, identity, onError, onMessage, pool, ready, targetSize])

  const act = useCallback((action: DraftAction): void => {
    if (!state) return
    if (activeIdentity !== identity || state.poolKey !== poolKey) { reset(); return }
    onError(null)
    try {
      const next = applyDraftAction(state, pool, action, engineOptions)
      setState(next)
      onMessage(actionMessage(action, next, pool))
    } catch (reason) { onError(reason instanceof Error ? reason.message : String(reason)) }
  }, [activeIdentity, engineOptions, identity, onError, onMessage, pool, poolKey, reset, state])

  const pick = useCallback((operatorId: string): void => act({ type: 'pick', operatorId }), [act])
  const evaluate = useCallback((action: DraftAction): DraftActionAvailability => state ? evaluateDraftAction(state, pool, action, engineOptions) : { available: false, reason: 'draft-complete' }, [engineOptions, pool, state])
  const pointDelta = useCallback((action: DraftAction): number => state ? getDraftActionPointDelta(pool, action, engineOptions, state) : 0, [engineOptions, pool, state])

  return { state, configuration: resolvedConfiguration, distributionLabel: draftPullDistributionLabel(resolvedConfiguration.pullDistribution), start, act, pick, evaluate, pointDelta, reset }
}
