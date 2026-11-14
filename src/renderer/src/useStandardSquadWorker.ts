import { useCallback, useEffect, useRef, useState } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import type { Operator } from '../../shared/operator'
import type { ConstraintValidationResult, rollSquadReroll } from '../../shared/randomizer'
import type { checkStandardRerolls } from './standardRerollChecks'

export type StandardSquadRequest =
  | { type: 'check'; input: Parameters<typeof checkStandardRerolls>[0] }
  | { type: 'validate' | 'initial'; constraints: RandomizerConstraints; pool: Operator[] }
  | { type: 'reroll'; plan: Parameters<typeof rollSquadReroll>[0] }

type WorkerResult = ReturnType<typeof checkStandardRerolls> | ConstraintValidationResult | Operator[]

export function useStandardSquadWorker() {
  const nextId = useRef(0)
  const active = useRef(new Set<Worker>())

  useEffect(() => {
    const workers = active.current
    return () => {
      for (const worker of workers) worker.terminate()
      workers.clear()
    }
  }, [])

  return useCallback((request: StandardSquadRequest, onResult: (result: WorkerResult) => void, onError: (error: string) => void) => {
    const id = ++nextId.current
    let worker: Worker
    try {
      worker = new Worker(new URL('./standardSquadWorker.ts', import.meta.url), { type: 'module' })
    } catch (error) {
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) onError(error instanceof Error ? error.message : String(error))
      })
      return () => { cancelled = true }
    }
    active.current.add(worker)
    const stop = () => {
      worker.terminate()
      active.current.delete(worker)
    }
    worker.onmessage = ({ data }: MessageEvent<{ id: number; result: WorkerResult; error?: string }>) => {
      if (data.id !== id) return
      stop()
      if (data.error) onError(data.error)
      else onResult(data.result)
    }
    worker.onerror = (event) => {
      stop()
      onError(event.message || 'The squad check could not run.')
    }
    worker.postMessage({ id, request })
    return stop
  }, [])
}

export function useStandardSquadCheck<Result extends WorkerResult>(
  request: StandardSquadRequest | null,
  run: ReturnType<typeof useStandardSquadWorker>,
) {
  const [completed, setCompleted] = useState<{ request: StandardSquadRequest; result?: Result; error?: string }>()
  useEffect(() => {
    if (!request) return
    return run(
      request,
      (result) => setCompleted({ request, result: result as Result }),
      (error) => setCompleted({ request, error }),
    )
  }, [request, run])
  return completed?.request === request ? completed : undefined
}
