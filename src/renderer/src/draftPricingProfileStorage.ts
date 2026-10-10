import {
  DRAFT_PRICING_PROFILE_SCHEMA_VERSION,
  SHARED_BALANCE_PRICING_PROFILE,
  type DraftPricingProfile,
} from '../../shared/draftPricingProfile'
import { loadDraftPricingProfiles, saveDraftPricingProfiles } from './rendererPersistence'

function cloneProfile(profile: DraftPricingProfile): DraftPricingProfile {
  return JSON.parse(JSON.stringify(profile)) as DraftPricingProfile
}

function localPricingProfileId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `local:pricing:${random}`
}

export function createLocalDraftPricingProfile(
  source: DraftPricingProfile = SHARED_BALANCE_PRICING_PROFILE,
  name = source.id === SHARED_BALANCE_PRICING_PROFILE.id
    ? 'New Draft Pricing'
    : `${source.name} Copy`,
): DraftPricingProfile {
  const next = cloneProfile(source)
  return {
    ...next,
    schemaVersion: DRAFT_PRICING_PROFILE_SCHEMA_VERSION,
    id: localPricingProfileId(),
    name,
    createdAt: new Date().toISOString(),
    revision: '1',
  }
}

export function loadCustomDraftPricingProfiles(): DraftPricingProfile[] {
  return loadDraftPricingProfiles()
}

export function saveCustomDraftPricingProfiles(profiles: readonly DraftPricingProfile[]): void {
  saveDraftPricingProfiles(profiles)
}
