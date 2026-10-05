import type { DraftRulebook } from './types'
import { assertValidDraftRulebook } from './validationWithHold'

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function serializeDraftRulebook(rulebook: DraftRulebook): string {
  assertValidDraftRulebook(rulebook)
  return `${JSON.stringify(rulebook, null, 2)}\n`
}

export function deserializeDraftRulebook(serialized: string): DraftRulebook {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    throw new Error('Draft Rulebook file is not valid JSON.')
  }
  assertValidDraftRulebook(parsed)
  return cloneJson(parsed)
}
