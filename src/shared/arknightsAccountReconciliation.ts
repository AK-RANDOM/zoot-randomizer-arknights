import type {
  ImportedArknightsAccount,
  ImportedOperatorFormProgress,
  ImportedOperatorProgress,
} from './arknightsAccount'
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

export interface ImportedAccountOperatorState {
  operatorId: string
  level: number
  elite: 0 | 1 | 2
  equippedSkinId?: string
  source: 'operator' | 'form'
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

function stateFromOperator(progress: ImportedOperatorProgress): ImportedAccountOperatorState {
  return {
    operatorId: progress.operatorId,
    level: progress.level,
    elite: progress.elite,
    equippedSkinId: progress.equippedSkinId,
    source: 'operator',
  }
}

function stateFromForm(form: ImportedOperatorFormProgress): ImportedAccountOperatorState {
  return {
    operatorId: form.formId,
    level: form.level,
    elite: form.elite,
    equippedSkinId: form.equippedSkinId,
    source: 'form',
  }
}

export function importedAccountOperatorState(
  snapshot: ImportedArknightsAccount,
  operatorId: string,
): ImportedAccountOperatorState | null {
  for (const progress of snapshot.operators) {
    const matchingForm = progress.forms?.find((form) => form.formId === operatorId)
    if (matchingForm) return stateFromForm(matchingForm)
    if (progress.operatorId === operatorId) return stateFromOperator(progress)
  }
  return null
}

export function importedAccountEquippedSkinId(
  snapshot: ImportedArknightsAccount,
  operatorId: string,
): string | null {
  return importedAccountOperatorState(snapshot, operatorId)?.equippedSkinId ?? null
}

export function importedAccountOwnsSkin(
  snapshot: ImportedArknightsAccount,
  skinId: string,
): boolean {
  return snapshot.ownedSkinIds.includes(skinId)
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
    for (const art of operator.defaultArts ?? []) {
      if (!identities.has(art.id)) {
        identities.set(art.id, {
          skinId: art.id,
          operatorId: operator.id,
          appearance: 'default',
        })
      }
    }
    for (const skin of operator.skins ?? []) {
      if (!identities.has(skin.id)) {
        identities.set(skin.id, {
          skinId: skin.id,
          operatorId: operator.id,
          appearance: skin.isDefault ? 'default' : `skin:${skin.id}`,
        })
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
