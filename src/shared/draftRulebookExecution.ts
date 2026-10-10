import type { Operator } from './operator'
import type { DraftPricingProfile } from './draftPricingProfile'
import {
  resolveDraftConfiguration,
  validateDraftConfiguration,
  type ResolvedDraftConfiguration,
} from './draft'
import {
  resolveDraftRulebook,
  serializeDraftRulebook,
  validateDraftRulebook,
  type DraftRulebook,
  type DraftRulebookValidationResult,
} from './draftRulebook'
import { resolveDraftRulebookInteractions } from './draftRulebookInteractions'
import { resolveDraftRulebookPool } from './draftRulebookPool'

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
  pricingProfiles: readonly DraftPricingProfile[] = [],
): DraftRulebookExecutionResolution {
  const baseValidation = validateDraftRulebook(rulebook)
  const pricingProfileId = rulebook.generalRules.pricingProfileId ?? null
  const pricingProfile = pricingProfileId
    ? (pricingProfiles.find((profile) => profile.id === pricingProfileId) ?? null)
    : null
  const validation =
    pricingProfileId && !pricingProfile
      ? {
          valid: false,
          errors: [
            ...baseValidation.errors,
            `Pricing profile “${pricingProfileId}” is not available.`,
          ],
        }
      : baseValidation
  const serializedRulebook = validation.valid ? serializeDraftRulebook(rulebook) : null
  const invalidIdentityKey = `${rulebook.identifier.id}:${rulebook.identifier.revision}:invalid`

  if (!validation.valid || serializedRulebook === null) {
    return {
      valid: false,
      validation,
      pool: [],
      configuration: null,
      identityKey: invalidIdentityKey,
      poolSourceLabel: draftRulebookPoolSourceLabel(rulebook),
    }
  }

  const resolved = resolveDraftRulebook(rulebook, pricingProfile)
  const pool = resolveDraftRulebookPool(rulebook.pool, datasetOperators, globalPool)
  const interactions = resolveDraftRulebookInteractions(rulebook.interactions, datasetOperators)
  const configuration = resolveDraftConfiguration({
    ...resolved.configuration,
    interactions,
  })
  validateDraftConfiguration(configuration)

  return {
    valid: true,
    validation,
    pool,
    configuration,
    identityKey: `${serializedRulebook}${JSON.stringify(pricingProfile)}${JSON.stringify(interactions)}`,
    poolSourceLabel: draftRulebookPoolSourceLabel(rulebook),
  }
}
