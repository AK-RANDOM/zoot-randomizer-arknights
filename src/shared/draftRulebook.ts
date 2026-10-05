// Stable public facade for Draft Rulebook schema/domain APIs.
// Internals live under ./rulebook so future schema growth does not recreate a monolith.
export * from './rulebook/types'
export * from './rulebook/defaults'
export {
  assertValidDraftRulebook,
  validateDraftRulebook,
} from './rulebook/validation'
export {
  deserializeDraftRulebook,
  serializeDraftRulebook,
} from './rulebook/serialization'
export { resolveDraftRulebook } from './rulebook/resolution'
export {
  DRAFT_RULEBOOK_SELECTOR_TYPE_OPTIONS,
  createDefaultDraftRulebookSelector,
  createDraftRulebookDatasetReferences,
  createDraftRulebookSelectorCatalog,
  inspectDraftRulebookSelectorReferences,
  matchesDraftRulebookEligibility,
  matchesDraftRulebookSelector,
  resolveDraftRulebookEligibility,
  resolveDraftRulebookSelector,
  validateDraftRulebookEligibility,
  validateDraftRulebookSelector,
  type DraftRulebookDatasetReferences,
  type DraftRulebookSelectorCatalog,
  type DraftRulebookSelectorOption,
  type DraftRulebookSelectorReference,
} from './rulebook/selectors'
export {
  DRAFT_RULEBOOK_MIGRATIONS,
  migrateDraftRulebookDocument,
  type DraftRulebookMigration,
  type DraftRulebookMigrationIssue,
  type DraftRulebookMigrationResult,
} from './rulebook/migrations'
