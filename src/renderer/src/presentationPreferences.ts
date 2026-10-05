import { useEffect, useState } from 'react'
import type { PromotionArt } from '../../shared/portraits'
import { loadOperatorArtwork, saveOperatorArtwork } from './rendererPersistence'

const ARTWORK_PREFERENCE_EVENT = 'arknights-randomizer:operator-artwork-changed'

export function readOperatorArtworkPreference(): PromotionArt {
  return loadOperatorArtwork()
}

export function setOperatorArtworkPreference(value: PromotionArt): void {
  saveOperatorArtwork(value)
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
