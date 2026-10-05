import type { Operator } from './operator'
import {
  resolveDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
  type DraftRulebook,
  type DraftRulebookValidationResult,
} from './draftRulebook'
import { resolveDraftRulebookPool } from './draftRulebookPool'
import type { ResolvedDraftConfiguration } from './draft'

export interface DraftRulebookExecutionResolution {
  valid: boolean
  validation: DraftRulebookValidationResult
  pool: Operator[]
  configuration: ResolvedDraftConfiguration | null
  identityKey: string
  poolSourceLabel: string
}

export function draftRulebookPoolSourceLabel(rulebook: DraftRulebook): string {
  switch (rulebook.pool.source) {
    case 'inherit-global':
      return 'Inherit Global Pool'
    case 'global-restrictions':
      return 'Global Pool + Rulebook Restrictions'
    case 'rulebook-pool':
      return 'Rulebook Pool'
  }
}

/**
 * Converts a portable Rulebook into the exact runtime inputs used by Draft execution.
 * Invalid in-progress documents never leak a fallback/default configuration into play.
 */
export function resolveDraftRulebookExecution(
  rulebook: DraftRulebook,
  datasetOperators: readonly Operator[],
  globalPool: readonly Operator[],
): DraftRulebookExecutionResolution {
  const validation = validateDraftRulebook(rulebook)
  const identityKey = validation.valid
    ? serializeDraftRulebook(rulebook)
    : `${rulebook.identifier.id}:${rulebook.identifier.revision}:invalid`

  if (!validation.valid) {
    return {
      valid: false,
      validation,
      pool: [],
      configuration: null,
      identityKey,
      poolSourceLabel: draftRulebookPoolSourceLabel(rulebook),
    }
  }

  const resolved = resolveDraftRulebook(rulebook)
  return {
    valid: true,
    validation,
    pool: resolveDraftRulebookPool(rulebook.pool, datasetOperators, globalPool),
    configuration: resolved.configuration,
    identityKey,
    poolSourceLabel: draftRulebookPoolSourceLabel(rulebook),
  }
}
