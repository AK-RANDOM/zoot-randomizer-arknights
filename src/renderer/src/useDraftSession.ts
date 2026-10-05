import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Operator } from '../../shared/operator'
import {
  STANDARD_DRAFT_CONFIGURATION,
  createDraftPoolKey,
  draftPullDistributionLabel,
  pickDraftOperator,
  resolveDraftConfiguration,
  startDraft,
  type DraftConfigurationInput,
  type DraftState,
} from '../../shared/draft'
import { draftCompletionMessage } from './draftSessionMessages'

export const DRAFT_SESSION_RESET_EVENT = 'arknights-randomizer:draft-session-reset'

interface UseDraftSessionOptions {
  pool: readonly Operator[]
  targetSize: number
  ready: boolean
  configuration?: DraftConfigurationInput
  sessionKey?: string
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}

export interface DraftSessionController {
  state: DraftState | null
  distributionLabel: string
  start: () => void
  pick: (operatorId: string) => void
  reset: (message?: string) => void
}

const RESET_MESSAGE = 'Draft reset because the squad size, eligible pool, or Draft Rulebook changed.'

export default function useDraftSession({
  pool,
  targetSize,
  ready,
  configuration,
  sessionKey,
  onMessage,
  onError,
}: UseDraftSessionOptions): DraftSessionController {
  const [state, setState] = useState<DraftState | null>(null)
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null)
  const resolvedConfiguration = useMemo(
    () => resolveDraftConfiguration(configuration ?? STANDARD_DRAFT_CONFIGURATION),
    [configuration],
  )
  const engineOptions = useMemo(
    () => ({ configuration: resolvedConfiguration }),
    [resolvedConfiguration],
  )
  const poolKey = useMemo(() => createDraftPoolKey(pool, targetSize), [pool, targetSize])
  const identity = useMemo(
    () => `${poolKey}\n${sessionKey ?? JSON.stringify(resolvedConfiguration)}`,
    [poolKey, resolvedConfiguration, sessionKey],
  )

  const reset = useCallback((message = RESET_MESSAGE): void => {
    setState(null)
    setActiveIdentity(null)
    onError(null)
    onMessage(message)
  }, [onError, onMessage])

  useEffect(() => {
    if (!state || activeIdentity === identity) return
    reset()
  }, [activeIdentity, identity, reset, state])

  useEffect(() => {
    const listener = (): void => reset()
    window.addEventListener(DRAFT_SESSION_RESET_EVENT, listener)
    return () => window.removeEventListener(DRAFT_SESSION_RESET_EVENT, listener)
  }, [reset])

  const start = useCallback((): void => {
    if (!ready) return
    onError(null)
    try {
      const next = startDraft(pool, targetSize, engineOptions)
      setState(next)
      setActiveIdentity(identity)
      onMessage(
        next.status === 'complete'
          ? draftCompletionMessage(next)
          : `Draft started. Pick 1 of 3 for a target roster of ${next.targetSize}.`,
      )
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [engineOptions, identity, onError, onMessage, pool, ready, targetSize])

  const pick = useCallback(
    (operatorId: string): void => {
      if (!state) return
      if (activeIdentity !== identity || state.poolKey !== poolKey) {
        reset()
        return
      }

      onError(null)
      try {
        const pickedOperator = pool.find((operator) => operator.id === operatorId)
        const next = pickDraftOperator(state, pool, operatorId, engineOptions)
        setState(next)
        onMessage(
          next.status === 'complete'
            ? draftCompletionMessage(next)
            : `${pickedOperator?.name ?? 'Operator'} drafted. ${next.draftedOperatorIds.length} / ${next.targetSize} selected.`,
        )
      } catch (reason) {
        onError(reason instanceof Error ? reason.message : String(reason))
      }
    },
    [activeIdentity, engineOptions, identity, onError, onMessage, pool, poolKey, reset, state],
  )

  return {
    state,
    distributionLabel: draftPullDistributionLabel(resolvedConfiguration.pullDistribution),
    start,
    pick,
    reset,
  }
}
