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

interface UseDraftSessionOptions {
  pool: readonly Operator[]
  targetSize: number
  ready: boolean
  configuration?: DraftConfigurationInput
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}

export interface DraftSessionController {
  state: DraftState | null
  distributionLabel: string
  start: () => void
  pick: (operatorId: string) => void
}

const RESET_MESSAGE = 'Draft reset because the squad size or eligible operator pool changed.'

export default function useDraftSession({
  pool,
  targetSize,
  ready,
  configuration,
  onMessage,
  onError,
}: UseDraftSessionOptions): DraftSessionController {
  const [state, setState] = useState<DraftState | null>(null)
  const resolvedConfiguration = useMemo(
    () => resolveDraftConfiguration(configuration ?? STANDARD_DRAFT_CONFIGURATION),
    [configuration],
  )
  const engineOptions = useMemo(
    () => ({ configuration: resolvedConfiguration }),
    [resolvedConfiguration],
  )
  const poolKey = useMemo(() => createDraftPoolKey(pool, targetSize), [pool, targetSize])

  useEffect(() => {
    if (!state || state.poolKey === poolKey) return
    setState(null)
    onMessage(RESET_MESSAGE)
  }, [onMessage, poolKey, state])

  const start = useCallback((): void => {
    if (!ready) return
    onError(null)
    try {
      const next = startDraft(pool, targetSize, engineOptions)
      setState(next)
      onMessage(
        next.status === 'complete'
          ? draftCompletionMessage(next)
          : `Draft started. Pick 1 of 3 for a target roster of ${next.targetSize}.`,
      )
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [engineOptions, onError, onMessage, pool, ready, targetSize])

  const pick = useCallback(
    (operatorId: string): void => {
      if (!state) return
      if (state.poolKey !== poolKey) {
        setState(null)
        onMessage(RESET_MESSAGE)
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
    [engineOptions, onError, onMessage, pool, poolKey, state],
  )

  return {
    state,
    distributionLabel: draftPullDistributionLabel(resolvedConfiguration.pullDistribution),
    start,
    pick,
  }
}
