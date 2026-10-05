import type { Operator } from './operator'
import type { DraftRulebookPool } from './draftRulebook'
import {
  matchesDraftRulebookEligibility,
  matchesDraftRulebookSelector,
  resolveDraftRulebookEligibility,
  resolveDraftRulebookSelector,
} from './rulebook/selectors'

// Preserve the established public pool-module API while selector semantics live
// in one shared domain module used by execution, authoring and portability.
export {
  matchesDraftRulebookEligibility,
  matchesDraftRulebookSelector,
  resolveDraftRulebookEligibility,
  resolveDraftRulebookSelector,
}

/**
 * Resolves the three locked Pool Source modes from #13.
 *
 * `globalPool` is the already-resolved app-wide pool after Global Pool filters.
 * `datasetOperators` is the full dataset available to the installation.
 *
 * Rulebook restrictions are restrictive-only because they filter `globalPool`.
 * Rulebook Pool intentionally starts from the dataset and therefore ignores
 * Global Pool exclusions for reproducible challenge/tournament Rulebooks.
 */
export function resolveDraftRulebookPool(
  pool: DraftRulebookPool,
  datasetOperators: readonly Operator[],
  globalPool: readonly Operator[],
): Operator[] {
  switch (pool.source) {
    case 'inherit-global':
      return [...globalPool]
    case 'global-restrictions':
      return resolveDraftRulebookEligibility(globalPool, pool.eligibility)
    case 'rulebook-pool':
      return resolveDraftRulebookEligibility(datasetOperators, pool.eligibility)
  }
}
