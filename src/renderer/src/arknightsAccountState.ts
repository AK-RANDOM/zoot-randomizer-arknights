import { useEffect, useState } from 'react'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'

let cachedSnapshot: ImportedArknightsAccount | null | undefined
let loadingSnapshot: Promise<ImportedArknightsAccount | null> | null = null
let pollTimer: number | null = null
const listeners = new Set<() => void>()

function snapshotIdentity(snapshot: ImportedArknightsAccount | null | undefined): string {
  if (snapshot === undefined) return 'loading'
  if (snapshot === null) return 'none'
  return `${snapshot.server}:${snapshot.uid ?? ''}:${snapshot.fetchedAt}:${snapshot.operators.length}:${snapshot.ownedSkinIds.length}`
}

function publishSnapshot(snapshot: ImportedArknightsAccount | null): void {
  if (snapshotIdentity(snapshot) === snapshotIdentity(cachedSnapshot)) return
  cachedSnapshot = snapshot
  for (const listener of listeners) listener()
}

async function loadSnapshot(): Promise<ImportedArknightsAccount | null> {
  if (!loadingSnapshot) {
    loadingSnapshot = window.desktop
      .getImportedArknightsAccount()
      .then((snapshot) => {
        publishSnapshot(snapshot)
        return snapshot
      })
      .finally(() => {
        loadingSnapshot = null
      })
  }
  return loadingSnapshot
}

function ensurePolling(): void {
  if (pollTimer !== null || typeof window === 'undefined') return
  void loadSnapshot().catch(() => undefined)
  pollTimer = window.setInterval(() => {
    void loadSnapshot().catch(() => undefined)
  }, 1500)
}

function stopPollingIfIdle(): void {
  if (listeners.size !== 0 || pollTimer === null) return
  window.clearInterval(pollTimer)
  pollTimer = null
}

export function getCachedImportedArknightsAccount(): ImportedArknightsAccount | null | undefined {
  return cachedSnapshot
}

export function subscribeImportedArknightsAccount(listener: () => void): () => void {
  listeners.add(listener)
  ensurePolling()
  return () => {
    listeners.delete(listener)
    stopPollingIfIdle()
  }
}

export function notifyImportedArknightsAccountChanged(
  snapshot?: ImportedArknightsAccount | null,
): void {
  if (snapshot === undefined) {
    void loadSnapshot().catch(() => undefined)
    return
  }
  publishSnapshot(snapshot)
}

export function useImportedArknightsAccount(): ImportedArknightsAccount | null | undefined {
  const [snapshot, setSnapshot] = useState<ImportedArknightsAccount | null | undefined>(
    cachedSnapshot,
  )

  useEffect(() => {
    const refresh = (): void => setSnapshot(cachedSnapshot)
    const unsubscribe = subscribeImportedArknightsAccount(refresh)
    refresh()
    return unsubscribe
  }, [])

  return snapshot
}
