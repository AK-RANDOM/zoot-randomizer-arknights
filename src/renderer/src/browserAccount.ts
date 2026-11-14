import {
  ARKNIGHTS_ACCOUNT_SNAPSHOT_VERSION,
  type ImportedArknightsAccount,
} from '../../shared/arknightsAccount'

const snapshotKey = 'arknights-randomizer:account-snapshot:v1'

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
