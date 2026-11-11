import type { ArknightsAccountServer } from '../../shared/arknightsAccount'
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
