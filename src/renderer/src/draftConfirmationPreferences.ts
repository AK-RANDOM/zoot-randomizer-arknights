import type { DraftConfirmationMode } from './draftConfirmationPolicy'
import { useEffect, useState } from 'react'
import { loadDraftConfirmationMode, saveDraftConfirmationMode } from './rendererPersistence'

const DRAFT_CONFIRMATION_PREFERENCE_EVENT = 'arknights-randomizer:draft-confirmations-changed'

export function readDraftActionConfirmationPreference(): DraftConfirmationMode {
  return loadDraftConfirmationMode()
}

export function setDraftActionConfirmationPreference(enabled: DraftConfirmationMode): void {
  saveDraftConfirmationMode(enabled)
  window.dispatchEvent(
    new CustomEvent<DraftConfirmationMode>(DRAFT_CONFIRMATION_PREFERENCE_EVENT, {
      detail: enabled,
    }),
  )
}

export function useDraftActionConfirmationPreference(): DraftConfirmationMode {
  const [enabled, setEnabled] = useState<DraftConfirmationMode>(() =>
    readDraftActionConfirmationPreference(),
  )

  useEffect(() => {
    const onChanged = (event: Event): void => {
      const next = (event as CustomEvent<DraftConfirmationMode>).detail
      if (['action', 'run', 'session', 'never'].includes(next)) setEnabled(next)
    }
    window.addEventListener(DRAFT_CONFIRMATION_PREFERENCE_EVENT, onChanged)
    return () => window.removeEventListener(DRAFT_CONFIRMATION_PREFERENCE_EVENT, onChanged)
  }, [])

  return enabled
}
