import type { DraftRulebook } from '../../shared/draftRulebook'
import {
  DRAFT_PRICING_PROFILE_SCHEMA_VERSION,
  validateDraftPricingProfile,
  type DraftPricingProfile,
} from '../../shared/draftPricingProfile'
import { STANDARD_DRAFT_RULEBOOK_ID } from '../../shared/draftRulebook'
import { migrateDraftRulebookDocument } from '../../shared/draftRulebookPortability'
import { cloneSquadConfiguration, type StoredSquadPreset } from '../../shared/presets'
import {
  createDefaultOperatorPreferences,
  normalizeOperatorPreferences,
  type OperatorPreferences,
} from '../../shared/operatorPool'
import type { PromotionArt } from '../../shared/portraits'

export const RENDERER_PERSISTENCE_KEY = 'arknights-randomizer:renderer-state:v1'
export const RENDERER_PERSISTENCE_VERSION = 1 as const

const LEGACY_OPERATOR_PREFERENCES_KEY = 'arknights-randomizer:operator-preferences:v1'
const LEGACY_SQUAD_PRESETS_KEY = 'arknights-randomizer:squad-presets:v1'
const LEGACY_BOUND_WARNING_KEY = 'arknights-randomizer:dismiss-bound-reset-warning'
const LEGACY_PRESET_WARNING_KEY = 'arknights-randomizer:dismiss-preset-replace-warning'
const LEGACY_SELECTED_RULEBOOK_KEY = 'arknights-randomizer:selected-draft-rulebook:v1'
const LEGACY_RULEBOOK_LIBRARY_KEY = 'arknights-randomizer:draft-rulebooks:v1'
const LEGACY_RULEBOOK_IMPORTED_IDS_KEY = 'arknights-randomizer:draft-rulebooks:imported:v1'
const LEGACY_RACE_FILTER_KEY = 'arknights-randomizer:race-filter:v1'
const LEGACY_ARTWORK_PREFERENCE_KEY = 'arknights-randomizer:operator-artwork:v1'

export type RulebookOrigin = 'built-in' | 'local' | 'imported'

export interface RulebookLibraryEntry {
  document: DraftRulebook
  origin: RulebookOrigin
  editor: {
    lastEditedAt: string | null
  }
}

export interface RendererPersistenceState {
  version: typeof RENDERER_PERSISTENCE_VERSION
  operatorPreferences: OperatorPreferences
  squadPresets: StoredSquadPreset[]
  dismissedWarnings: string[]
  selectedDraftRulebookId: string
  raceExcludedIds: string[]
  operatorArtwork: PromotionArt
  confirmDraftActions: boolean
  rulebookLibrary: RulebookLibraryEntry[]
  pricingProfiles: DraftPricingProfile[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

function isStoredPreset(value: unknown): value is StoredSquadPreset {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredSquadPreset>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    candidate.builtIn === false &&
    !!candidate.configuration &&
    typeof candidate.configuration === 'object'
  )
}

function normalizeSquadPresets(value: unknown): StoredSquadPreset[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: StoredSquadPreset[] = []
  for (const candidate of value) {
    if (!isStoredPreset(candidate) || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    result.push({
      ...candidate,
      builtIn: false,
      configuration: cloneSquadConfiguration(candidate.configuration),
    })
  }
  return result
}

/**
 * Persistence accepts documents that are temporarily invalid in the editor, but
 * still requires the stable object/array shape that editor components need in
 * order to render safely. Execution/export validity remains the job of
 * validateDraftRulebook().
 */
function isEditableRulebookDocument(value: unknown): value is DraftRulebook {
  if (!isRecord(value) || !isRecord(value.identifier) || !isRecord(value.generalRules)) return false
  if (!isRecord(value.pool) || !isRecord(value.overrides) || !Array.isArray(value.interactions))
    return false

  const identifier = value.identifier
  if (typeof identifier.id !== 'string' || identifier.id.length === 0) return false
  if (typeof identifier.name !== 'string' || typeof identifier.description !== 'string')
    return false
  if (typeof identifier.createdAt !== 'string' || typeof identifier.revision !== 'string')
    return false

  if (!isRecord(value.overrides.operatorCosts)) return false
  if (value.pool.source === 'inherit-global') return true
  if (value.pool.source !== 'global-restrictions' && value.pool.source !== 'rulebook-pool')
    return false
  if (!isRecord(value.pool.eligibility)) return false
  return (
    Array.isArray(value.pool.eligibility.allOf) &&
    Array.isArray(value.pool.eligibility.anyOf) &&
    Array.isArray(value.pool.eligibility.noneOf)
  )
}

function migrateEditableRulebookDocument(value: unknown): DraftRulebook | null {
  const migration = migrateDraftRulebookDocument(value)
  const candidate = migration.issues.length === 0 ? migration.document : value
  if (!isEditableRulebookDocument(candidate)) return null
  return cloneJson(candidate) as DraftRulebook
}

function normalizeRulebookEntries(value: unknown): RulebookLibraryEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: RulebookLibraryEntry[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue
    const entry = candidate as Partial<RulebookLibraryEntry>
    const document = migrateEditableRulebookDocument(entry.document)
    if (!document) continue
    if (document.identifier.id === STANDARD_DRAFT_RULEBOOK_ID) continue
    if (seen.has(document.identifier.id)) continue
    const origin = entry.origin === 'imported' ? 'imported' : 'local'
    seen.add(document.identifier.id)
    result.push({
      document,
      origin,
      editor: {
        lastEditedAt:
          typeof entry.editor?.lastEditedAt === 'string' ? entry.editor.lastEditedAt : null,
      },
    })
  }
  return result
}

function normalizePricingProfiles(value: unknown): DraftPricingProfile[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: DraftPricingProfile[] = []
  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    const profile = cloneJson(candidate) as Partial<DraftPricingProfile>
    if (profile.schemaVersion !== DRAFT_PRICING_PROFILE_SCHEMA_VERSION) continue
    if (typeof profile.id !== 'string' || profile.id.length === 0 || seen.has(profile.id)) continue
    if (typeof profile.name !== 'string' || typeof profile.description !== 'string') continue
    if (typeof profile.createdAt !== 'string' || typeof profile.revision !== 'string') continue
    if (!isRecord(profile.operatorCosts)) continue
    const normalized = profile as DraftPricingProfile
    if (validateDraftPricingProfile(normalized).length > 0) continue
    seen.add(normalized.id)
    result.push(normalized)
  }
  return result
}

export function createDefaultRendererPersistenceState(): RendererPersistenceState {
  return {
    version: RENDERER_PERSISTENCE_VERSION,
    operatorPreferences: createDefaultOperatorPreferences(),
    squadPresets: [],
    dismissedWarnings: [],
    selectedDraftRulebookId: STANDARD_DRAFT_RULEBOOK_ID,
    raceExcludedIds: [],
    operatorArtwork: 'e2',
    confirmDraftActions: true,
    rulebookLibrary: [],
    pricingProfiles: [],
  }
}

export function normalizeRendererPersistence(value: unknown): RendererPersistenceState {
  const defaults = createDefaultRendererPersistenceState()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as Partial<RendererPersistenceState>
  if (candidate.version !== RENDERER_PERSISTENCE_VERSION) return defaults
  return {
    version: RENDERER_PERSISTENCE_VERSION,
    operatorPreferences: normalizeOperatorPreferences(candidate.operatorPreferences),
    squadPresets: normalizeSquadPresets(candidate.squadPresets),
    dismissedWarnings: stringList(candidate.dismissedWarnings),
    selectedDraftRulebookId:
      typeof candidate.selectedDraftRulebookId === 'string' &&
      candidate.selectedDraftRulebookId.length > 0
        ? candidate.selectedDraftRulebookId
        : STANDARD_DRAFT_RULEBOOK_ID,
    raceExcludedIds: stringList(candidate.raceExcludedIds),
    operatorArtwork: candidate.operatorArtwork === 'e1' ? 'e1' : 'e2',
    confirmDraftActions: candidate.confirmDraftActions !== false,
    rulebookLibrary: normalizeRulebookEntries(candidate.rulebookLibrary),
    pricingProfiles: normalizePricingProfiles(candidate.pricingProfiles),
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function legacySquadPresets(storage: StorageLike): StoredSquadPreset[] {
  const parsed = parseJson(storage.getItem(LEGACY_SQUAD_PRESETS_KEY))
  if (!parsed || typeof parsed !== 'object') return []
  const envelope = parsed as { version?: unknown; presets?: unknown }
  return envelope.version === 1 ? normalizeSquadPresets(envelope.presets) : []
}

function legacyRulebookEntries(storage: StorageLike): RulebookLibraryEntry[] {
  const parsed = parseJson(storage.getItem(LEGACY_RULEBOOK_LIBRARY_KEY))
  if (!parsed || typeof parsed !== 'object') return []
  const envelope = parsed as { version?: unknown; rulebooks?: unknown }
  if (envelope.version !== 1 || !Array.isArray(envelope.rulebooks)) return []
  const imported = new Set(stringList(parseJson(storage.getItem(LEGACY_RULEBOOK_IMPORTED_IDS_KEY))))
  return normalizeRulebookEntries(
    envelope.rulebooks.map((document) => ({
      document,
      origin:
        isEditableRulebookDocument(document) && imported.has(document.identifier.id)
          ? 'imported'
          : 'local',
      editor: { lastEditedAt: null },
    })),
  )
}

function legacyRaceExclusions(storage: StorageLike): string[] {
  const parsed = parseJson(storage.getItem(LEGACY_RACE_FILTER_KEY))
  if (!parsed || typeof parsed !== 'object') return []
  const envelope = parsed as { version?: unknown; excludedIds?: unknown }
  return envelope.version === 1 ? stringList(envelope.excludedIds) : []
}

export function migrateLegacyRendererPersistence(storage: StorageLike): RendererPersistenceState {
  const defaults = createDefaultRendererPersistenceState()
  const rawPreferences = parseJson(storage.getItem(LEGACY_OPERATOR_PREFERENCES_KEY))
  const dismissedWarnings = [LEGACY_BOUND_WARNING_KEY, LEGACY_PRESET_WARNING_KEY].filter(
    (key) => storage.getItem(key) === '1',
  )
  const selectedDraftRulebookId = storage.getItem(LEGACY_SELECTED_RULEBOOK_KEY)
  return {
    ...defaults,
    operatorPreferences: normalizeOperatorPreferences(rawPreferences),
    squadPresets: legacySquadPresets(storage),
    dismissedWarnings,
    selectedDraftRulebookId: selectedDraftRulebookId || STANDARD_DRAFT_RULEBOOK_ID,
    raceExcludedIds: legacyRaceExclusions(storage),
    operatorArtwork: storage.getItem(LEGACY_ARTWORK_PREFERENCE_KEY) === 'e1' ? 'e1' : 'e2',
    rulebookLibrary: legacyRulebookEntries(storage),
  }
}

export function loadRendererPersistence(
  storage: StorageLike = window.localStorage,
): RendererPersistenceState {
  try {
    const raw = parseJson(storage.getItem(RENDERER_PERSISTENCE_KEY))
    if (
      raw &&
      typeof raw === 'object' &&
      (raw as { version?: unknown }).version === RENDERER_PERSISTENCE_VERSION
    ) {
      return normalizeRendererPersistence(raw)
    }
    const migrated = migrateLegacyRendererPersistence(storage)
    storage.setItem(RENDERER_PERSISTENCE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return createDefaultRendererPersistenceState()
  }
}

export function saveRendererPersistence(
  state: RendererPersistenceState,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(RENDERER_PERSISTENCE_KEY, JSON.stringify(normalizeRendererPersistence(state)))
  } catch {
    // Renderer state remains usable for the current session when storage is unavailable.
  }
}

export function updateRendererPersistence(
  mutate: (state: RendererPersistenceState) => RendererPersistenceState,
  storage: StorageLike = window.localStorage,
): RendererPersistenceState {
  const next = normalizeRendererPersistence(mutate(loadRendererPersistence(storage)))
  saveRendererPersistence(next, storage)
  return next
}

export function loadUserSquadPresets(): StoredSquadPreset[] {
  return loadRendererPersistence().squadPresets
}

export function saveUserSquadPresets(presets: readonly StoredSquadPreset[]): void {
  updateRendererPersistence((state) => ({ ...state, squadPresets: normalizeSquadPresets(presets) }))
}

export function warningIsDismissed(key: string): boolean {
  return loadRendererPersistence().dismissedWarnings.includes(key)
}

export function dismissWarning(key: string): void {
  updateRendererPersistence((state) => ({
    ...state,
    dismissedWarnings: stringList([...state.dismissedWarnings, key]),
  }))
}

export function loadSelectedDraftRulebookId(): string {
  return loadRendererPersistence().selectedDraftRulebookId
}

export function saveSelectedDraftRulebookId(selectedDraftRulebookId: string): void {
  updateRendererPersistence((state) => ({ ...state, selectedDraftRulebookId }))
}

export function loadRaceExclusions(): string[] {
  return loadRendererPersistence().raceExcludedIds
}

export function saveRaceExclusions(raceExcludedIds: readonly string[]): void {
  updateRendererPersistence((state) => ({ ...state, raceExcludedIds: stringList(raceExcludedIds) }))
}

export function loadOperatorArtwork(): PromotionArt {
  return loadRendererPersistence().operatorArtwork
}

export function saveOperatorArtwork(operatorArtwork: PromotionArt): void {
  updateRendererPersistence((state) => ({ ...state, operatorArtwork }))
}

export function loadDraftActionConfirmations(): boolean {
  return loadRendererPersistence().confirmDraftActions
}

export function saveDraftActionConfirmations(confirmDraftActions: boolean): void {
  updateRendererPersistence((state) => ({ ...state, confirmDraftActions }))
}

export function loadRulebookLibraryEntries(): RulebookLibraryEntry[] {
  return loadRendererPersistence().rulebookLibrary.map((entry) => cloneJson(entry))
}

export function saveRulebookLibraryEntries(entries: readonly RulebookLibraryEntry[]): void {
  updateRendererPersistence((state) => ({
    ...state,
    rulebookLibrary: normalizeRulebookEntries(entries),
  }))
}

export function loadDraftPricingProfiles(): DraftPricingProfile[] {
  return loadRendererPersistence().pricingProfiles.map((profile) => cloneJson(profile))
}

export function saveDraftPricingProfiles(profiles: readonly DraftPricingProfile[]): void {
  updateRendererPersistence((state) => ({
    ...state,
    pricingProfiles: normalizePricingProfiles(profiles),
  }))
}
