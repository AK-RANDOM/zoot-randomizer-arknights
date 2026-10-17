import type { ImportedArknightsAccount } from './arknightsAccount'
import type { Operator, OperatorDataset } from './operator'

export interface ArknightsAccountIdentityCounts {
  owned: number
  recognized: number
  unknown: number
}

export interface ArknightsEquippedSkinCounts {
  equipped: number
  recognized: number
  unknown: number
}

export type ReconciledArknightsSkinAppearance = 'default' | `skin:${string}`

export interface ReconciledArknightsSkinIdentity {
  skinId: string
  operatorId: string
  appearance: ReconciledArknightsSkinAppearance
}

export interface ArknightsAccountReconciliation {
  operators: ArknightsAccountIdentityCounts
  skins: ArknightsAccountIdentityCounts
  equippedSkins: ArknightsEquippedSkinCounts
  unknownOperatorIds: string[]
  unknownSkinIds: string[]
  unknownEquippedSkinIds: string[]
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort()
}

export function importedAccountOwnedOperatorIds(snapshot: ImportedArknightsAccount): string[] {
  const ids: string[] = []
  for (const progress of snapshot.operators) {
    ids.push(progress.operatorId)
    for (const form of progress.forms ?? []) ids.push(form.formId)
  }
  return sortedUnique(ids)
}

function buildOperatorIdentityIndex(dataset: OperatorDataset): ReadonlyMap<string, Operator> {
  return new Map(dataset.operators.map((operator) => [operator.id, operator]))
}

export function resolveArknightsOperatorIdentity(
  dataset: OperatorDataset,
  operatorId: string,
): Operator | null {
  return buildOperatorIdentityIndex(dataset).get(operatorId) ?? null
}

function buildSkinIdentityIndex(
  dataset: OperatorDataset,
): ReadonlyMap<string, ReconciledArknightsSkinIdentity> {
  const identities = new Map<string, ReconciledArknightsSkinIdentity>()

  for (const operator of dataset.operators) {
    for (const skin of operator.skins ?? []) {
      if (!identities.has(skin.id)) {
        identities.set(skin.id, {
          skinId: skin.id,
          operatorId: operator.id,
          appearance: `skin:${skin.id}`,
        })
      }
    }
    for (const skinId of operator.nativeSkinIds ?? []) {
      if (!identities.has(skinId)) {
        identities.set(skinId, { skinId, operatorId: operator.id, appearance: 'default' })
      }
    }
  }

  return identities
}

export function resolveArknightsSkinIdentity(
  dataset: OperatorDataset,
  skinId: string,
): ReconciledArknightsSkinIdentity | null {
  return buildSkinIdentityIndex(dataset).get(skinId) ?? null
}

function equippedSkinIds(snapshot: ImportedArknightsAccount): string[] {
  const ids: string[] = []
  for (const progress of snapshot.operators) {
    if (progress.equippedSkinId) ids.push(progress.equippedSkinId)
    for (const form of progress.forms ?? []) {
      if (form.equippedSkinId) ids.push(form.equippedSkinId)
    }
  }
  return sortedUnique(ids)
}

export function reconcileArknightsAccount(
  snapshot: ImportedArknightsAccount,
  dataset: OperatorDataset,
): ArknightsAccountReconciliation {
  const operatorIdentities = buildOperatorIdentityIndex(dataset)
  const ownedOperatorIds = sortedUnique(snapshot.operators.map((operator) => operator.operatorId))
  const unknownOperatorIds = ownedOperatorIds.filter((id) => !operatorIdentities.has(id))

  const skinIdentities = buildSkinIdentityIndex(dataset)
  const ownedSkinIds = sortedUnique(snapshot.ownedSkinIds)
  const unknownSkinIds = ownedSkinIds.filter((skinId) => !skinIdentities.has(skinId))

  const equipped = equippedSkinIds(snapshot)
  const unknownEquippedSkinIds = equipped.filter((skinId) => !skinIdentities.has(skinId))

  return {
    operators: {
      owned: ownedOperatorIds.length,
      recognized: ownedOperatorIds.length - unknownOperatorIds.length,
      unknown: unknownOperatorIds.length,
    },
    skins: {
      owned: ownedSkinIds.length,
      recognized: ownedSkinIds.length - unknownSkinIds.length,
      unknown: unknownSkinIds.length,
    },
    equippedSkins: {
      equipped: equipped.length,
      recognized: equipped.length - unknownEquippedSkinIds.length,
      unknown: unknownEquippedSkinIds.length,
    },
    unknownOperatorIds,
    unknownSkinIds,
    unknownEquippedSkinIds,
  }
}
