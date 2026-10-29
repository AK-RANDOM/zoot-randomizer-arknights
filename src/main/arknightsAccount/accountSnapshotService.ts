import type {
  ArknightsAccountServer,
  ImportedArknightsAccount,
} from '../../shared/arknightsAccount'
import { parseArknightsSyncData, type AccountSyncParseResult } from './parser'
import { AccountSnapshotStore } from './snapshotStore'

export async function importAccountSyncData(
  store: AccountSnapshotStore,
  payload: unknown,
  server: ArknightsAccountServer,
  fetchedAt?: string,
): Promise<AccountSyncParseResult> {
  const parsed = parseArknightsSyncData(payload, server, fetchedAt)
  await store.save(parsed.snapshot)
  return parsed
}

export async function getImportedAccountSnapshot(
  store: AccountSnapshotStore,
): Promise<ImportedArknightsAccount | null> {
  return store.load()
}

export async function clearImportedAccountSnapshot(store: AccountSnapshotStore): Promise<void> {
  await store.clear()
}
