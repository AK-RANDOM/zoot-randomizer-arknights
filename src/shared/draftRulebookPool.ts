import type { Operator } from './operator'
import { operatorRaceIds } from './raceMetadata'
import type {
  DraftRulebookEligibility,
  DraftRulebookPool,
  DraftRulebookSelector,
} from './draftRulebook'

function operatorFactionIds(operator: Operator): Set<string> {
  const ids = new Set<string>()
  const faction = operator.faction
  for (const id of [
    faction.nationId,
    faction.groupId,
    faction.teamId,
    faction.main,
    ...(faction.primary ?? []),
    ...faction.affiliations,
  ]) {
    if (id) ids.add(id)
  }
  return ids
}

/**
 * Resolves one declarative Rulebook selector against one operator.
 * Values within a selector are ORed together; composition between selectors
 * is handled by DraftRulebookEligibility.
 */
export function matchesDraftRulebookSelector(
  operator: Operator,
  selector: DraftRulebookSelector,
): boolean {
  switch (selector.type) {
    case 'operators':
      return selector.operatorIds.includes(operator.id)
    case 'rarities':
      return selector.rarities.includes(operator.rarity)
    case 'classes':
      return selector.classes.includes(operator.class)
    case 'subclasses':
      return selector.subclassIds.includes(operator.subclass.id)
    case 'factions': {
      const factionIds = operatorFactionIds(operator)
      return selector.factionIds.some((id) => factionIds.has(id))
    }
    case 'races': {
      const races = new Set(operatorRaceIds(operator))
      return selector.raceIds.some((id) => races.has(id))
    }
  }
}

/**
 * Eligibility semantics:
 * - every allOf selector must match;
 * - when anyOf is non-empty, at least one selector must match;
 * - no noneOf selector may match.
 * Empty allOf/anyOf/noneOf arrays therefore represent an unrestricted pool.
 */
export function matchesDraftRulebookEligibility(
  operator: Operator,
  eligibility: DraftRulebookEligibility,
): boolean {
  if (!eligibility.allOf.every((selector) => matchesDraftRulebookSelector(operator, selector))) {
    return false
  }
  if (
    eligibility.anyOf.length > 0 &&
    !eligibility.anyOf.some((selector) => matchesDraftRulebookSelector(operator, selector))
  ) {
    return false
  }
  return !eligibility.noneOf.some((selector) => matchesDraftRulebookSelector(operator, selector))
}

export function resolveDraftRulebookSelector(
  operators: readonly Operator[],
  selector: DraftRulebookSelector,
): Operator[] {
  return operators.filter((operator) => matchesDraftRulebookSelector(operator, selector))
}

export function resolveDraftRulebookEligibility(
  operators: readonly Operator[],
  eligibility: DraftRulebookEligibility,
): Operator[] {
  return operators.filter((operator) => matchesDraftRulebookEligibility(operator, eligibility))
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
