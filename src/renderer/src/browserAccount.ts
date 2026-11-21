import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ArknightsAccountServer,
  type ArknightsAccountSyncResult,
  type ImportedArknightsAccount,
} from '../../shared/arknightsAccount'

const snapshotKey = 'arknights-randomizer:account-snapshot:v1'
const accountApiOrigin = import.meta.env.VITE_WEB_ACCOUNT_API_ORIGIN

async function accountRequest<T>(
  action: 'send-code' | 'sync',
  input: { server: ArknightsAccountServer; email: string; code?: string },
): Promise<T> {
  const endpoint = `/api/arknights/${action}`
  const url = accountApiOrigin ? new URL(endpoint, accountApiOrigin) : endpoint
  if (url instanceof URL && url.protocol !== 'https:') {
    throw new Error('The hosted account service requires HTTPS.')
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(65_000),
  })
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error(
      'Account sync requires the web account service. Open the Worker preview or hosted app.',
    )
  }
  const result = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'Account sync is temporarily unavailable.')
  return result
}

export async function requestBrowserLoginCode(server: ArknightsAccountServer, email: string) {
  await accountRequest('send-code', { server, email })
}

export async function syncBrowserAccount(
  server: ArknightsAccountServer,
  email: string,
  code: string,
) {
  const result = await accountRequest<ArknightsAccountSyncResult>('sync', { server, email, code })
  localStorage.setItem(snapshotKey, JSON.stringify(result.snapshot))
  return result
}

export async function getBrowserAccount(): Promise<ImportedArknightsAccount | null> {
  try {
    const raw = localStorage.getItem(snapshotKey)
    if (!raw) return null
    const snapshot = JSON.parse(raw) as ImportedArknightsAccount
    return snapshot?.schemaVersion === ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION &&
      Array.isArray(snapshot.operators) &&
      Array.isArray(snapshot.ownedSkinIds)
      ? snapshot
      : null
  } catch {
    return null
  }
}

export async function clearBrowserAccount(): Promise<void> {
  localStorage.removeItem(snapshotKey)
}
