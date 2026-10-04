import { useEffect, useState } from 'react'
import type { PromotionArt } from '../../shared/portraits'

const ARTWORK_PREFERENCE_KEY = 'arknights-randomizer:operator-artwork:v1'
const ARTWORK_PREFERENCE_EVENT = 'arknights-randomizer:operator-artwork-changed'

export function readOperatorArtworkPreference(): PromotionArt {
  try {
    return window.localStorage.getItem(ARTWORK_PREFERENCE_KEY) === 'e1' ? 'e1' : 'e2'
  } catch {
    return 'e2'
  }
}

export function setOperatorArtworkPreference(value: PromotionArt): void {
  try {
    window.localStorage.setItem(ARTWORK_PREFERENCE_KEY, value)
  } catch {
    // The preference still applies for this renderer session through the event below.
  }

  window.dispatchEvent(
    new CustomEvent<PromotionArt>(ARTWORK_PREFERENCE_EVENT, { detail: value }),
  )
}

export function useOperatorArtworkPreference(): PromotionArt {
  const [value, setValue] = useState<PromotionArt>(() => readOperatorArtworkPreference())

  useEffect(() => {
    const onChanged = (event: Event): void => {
      const nextValue = (event as CustomEvent<PromotionArt>).detail
      if (nextValue === 'e1' || nextValue === 'e2') setValue(nextValue)
    }

    window.addEventListener(ARTWORK_PREFERENCE_EVENT, onChanged)
    return () => window.removeEventListener(ARTWORK_PREFERENCE_EVENT, onChanged)
  }, [])

  return value
}
