import type { OperatorPreferences } from '../../shared/operatorPool'
import {
  loadRendererPersistence,
  updateRendererPersistence,
} from './rendererPersistence'

export function loadOperatorPreferences(): OperatorPreferences {
  return loadRendererPersistence().operatorPreferences
}

export function saveOperatorPreferences(preferences: OperatorPreferences): void {
  updateRendererPersistence((state) => ({ ...state, operatorPreferences: preferences }))
}
