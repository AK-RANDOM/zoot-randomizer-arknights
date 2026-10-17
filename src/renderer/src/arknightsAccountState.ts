import { useEffect, useState } from 'react'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'

let cachedSnapshot: ImportedArknightsAccount | null | undefined
let loadingSnapshot: Promise<ImportedArknightsAccount | null> | null = null

async function loadSnapshot(): Promise<ImportedArknightsAccount | null> {
  if (!loadingSnapshot) {
    loadingSnapshot = window.desktop
      .getImportedArknightsAccount()
      .then((snapshot) => {
        cachedSnapshot = snapshot
        return snapshot
      })
      .finally(() => {
        loadingSnapshot = null
      })
  }
  return loadingSnapshot
}

export function notifyImportedArknightsAccountChanged(
  snapshot?: ImportedArknightsAccount | null,
): void {
  if (snapshot !== undefined) cachedSnapshot = snapshot
}

export function useImportedArknightsAccount(): ImportedArknightsAccount | null | undefined {
  const [snapshot, setSnapshot] = useState<ImportedArknightsAccount | null | undefined>(
    cachedSnapshot,
  )

  useEffect(() => {
    let active = true

    const refresh = (): void => {
      void loadSnapshot()
        .then((next) => {
          if (active) setSnapshot(next)
        })
        .catch(() => {
          if (active && cachedSnapshot !== undefined) setSnapshot(cachedSnapshot)
        })
    }

    refresh()
    const interval = window.setInterval(refresh, 1500)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  return snapshot
}
