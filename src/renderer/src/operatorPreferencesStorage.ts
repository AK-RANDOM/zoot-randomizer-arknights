import {
  createDefaultOperatorPreferences,
  normalizeOperatorPreferences,
  type OperatorPreferences,
} from '../../shared/operatorPool'

export const OPERATOR_PREFERENCES_STORAGE_KEY = 'arknights-randomizer:operator-preferences:v1'

export function loadOperatorPreferences(): OperatorPreferences {
  try {
    const raw = window.localStorage.getItem(OPERATOR_PREFERENCES_STORAGE_KEY)
    if (!raw) return createDefaultOperatorPreferences()
    return normalizeOperatorPreferences(JSON.parse(raw))
  } catch {
    return createDefaultOperatorPreferences()
  }
}

export function saveOperatorPreferences(preferences: OperatorPreferences): void {
  try {
    window.localStorage.setItem(
      OPERATOR_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
  } catch {
    // Preferences continue to work for this session when storage is unavailable.
  }
}
