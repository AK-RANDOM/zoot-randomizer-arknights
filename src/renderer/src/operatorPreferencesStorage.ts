import type { OperatorPreferences } from '../../shared/operatorPool'
import {
  loadRendererPersistence,
  updateRendererPersistence,
} from './rendererPersistence'

/** Legacy key retained as a migration fixture; new writes use rendererPersistence. */
export const OPERATOR_PREFERENCES_STORAGE_KEY = 'arknights-randomizer:operator-preferences:v1'

export function loadOperatorPreferences(): OperatorPreferences {
  return loadRendererPersistence().operatorPreferences
}

export function saveOperatorPreferences(preferences: OperatorPreferences): void {
  updateRendererPersistence((state) => ({ ...state, operatorPreferences: preferences }))
}
