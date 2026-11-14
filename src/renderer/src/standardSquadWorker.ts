import { drawChainSquad, rollSquadReroll, validateConstraints } from '../../shared/randomizer'
import { checkStandardRerolls } from './standardRerollChecks'
import type { StandardSquadRequest } from './useStandardSquadWorker'

globalThis.onmessage = (event: MessageEvent<{ id: number; request: StandardSquadRequest }>) => {
  const { id, request } = event.data
  try {
    let result
    switch (request.type) {
      case 'check':
        result = checkStandardRerolls(request.input)
        break
      case 'validate':
        result = validateConstraints(request.constraints, request.pool)
        break
      case 'initial':
        result = drawChainSquad(request.pool, request.constraints)
        break
      case 'reroll':
        result = rollSquadReroll(request.plan)
        break
    }
    globalThis.postMessage({ id, result })
  } catch (error) {
    globalThis.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
