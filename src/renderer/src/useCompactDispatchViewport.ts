import { useSyncExternalStore } from 'react'

const query = '(max-width: 960px)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export default function useCompactDispatchViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
