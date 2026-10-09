import { useEffect, useState } from 'react'
import { loadDraftActionConfirmations, saveDraftActionConfirmations } from './rendererPersistence'

const DRAFT_CONFIRMATION_PREFERENCE_EVENT = 'arknights-randomizer:draft-confirmations-changed'

export function readDraftActionConfirmationPreference(): boolean {
  return loadDraftActionConfirmations()
}

export function setDraftActionConfirmationPreference(enabled: boolean): void {
  saveDraftActionConfirmations(enabled)
  window.dispatchEvent(
    new CustomEvent<boolean>(DRAFT_CONFIRMATION_PREFERENCE_EVENT, { detail: enabled }),
  )
}

export function useDraftActionConfirmationPreference(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readDraftActionConfirmationPreference())

  useEffect(() => {
    const onChanged = (event: Event): void => {
      const next = (event as CustomEvent<boolean>).detail
      if (typeof next === 'boolean') setEnabled(next)
    }
    window.addEventListener(DRAFT_CONFIRMATION_PREFERENCE_EVENT, onChanged)
    return () => window.removeEventListener(DRAFT_CONFIRMATION_PREFERENCE_EVENT, onChanged)
  }, [])

  return enabled
}
