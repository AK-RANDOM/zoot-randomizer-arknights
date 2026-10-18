export const GARRISON_STAGE_CAPACITY = 13 as const

export interface GarrisonStage {
  id: string
  name: string
  operatorIds: string[]
}

export interface GarrisonParticipation {
  operatorId: string
  stageCount: number
}

export interface GarrisonOperatorConflict {
  operatorId: string
  stageIds: string[]
  stageNames: string[]
}

export interface Garrison {
  id: string
  name: string
  duplicateOperatorsAllowed: boolean
  stages: GarrisonStage[]
}

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeGarrisonStageOperatorIds(operatorIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const operatorId of operatorIds) {
    const id = operatorId.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
    if (normalized.length === GARRISON_STAGE_CAPACITY) break
  }
  return normalized
}

export function createGarrisonStage(name: string, id = createId('stage')): GarrisonStage {
  return {
    id,
    name: name.trim() || 'Untitled Stage',
    operatorIds: [],
  }
}

export function createGarrison(name = 'Untitled Garrison', id = createId('garrison')): Garrison {
  return {
    id,
    name: name.trim() || 'Untitled Garrison',
    duplicateOperatorsAllowed: true,
    stages: [],
  }
}

export function cloneGarrisonStage(stage: GarrisonStage): GarrisonStage {
  return {
    id: stage.id,
    name: stage.name,
    operatorIds: normalizeGarrisonStageOperatorIds(stage.operatorIds),
  }
}

export function cloneGarrison(garrison: Garrison): Garrison {
  return {
    id: garrison.id,
    name: garrison.name,
    duplicateOperatorsAllowed: garrison.duplicateOperatorsAllowed,
    stages: garrison.stages.map(cloneGarrisonStage),
  }
}

export function garrisonEquals(left: Garrison, right: Garrison): boolean {
  return JSON.stringify(cloneGarrison(left)) === JSON.stringify(cloneGarrison(right))
}

export function getGarrisonParticipation(garrison: Garrison): GarrisonParticipation[] {
  const stageCountByOperator = new Map<string, number>()
  const firstSeenOrder: string[] = []

  for (const stage of garrison.stages) {
    for (const operatorId of new Set(normalizeGarrisonStageOperatorIds(stage.operatorIds))) {
      if (!stageCountByOperator.has(operatorId)) firstSeenOrder.push(operatorId)
      stageCountByOperator.set(operatorId, (stageCountByOperator.get(operatorId) ?? 0) + 1)
    }
  }

  // Descending usage, then earliest stage (top to bottom), then its slot position.
  // The first-seen list naturally records the stage/slot tie-break order.
  return firstSeenOrder
    .map((operatorId, firstPosition) => ({
      operatorId,
      stageCount: stageCountByOperator.get(operatorId) ?? 0,
      firstPosition,
    }))
    .sort(
      (left, right) =>
        right.stageCount - left.stageCount || left.firstPosition - right.firstPosition,
    )
    .map(({ operatorId, stageCount }) => ({ operatorId, stageCount }))
}

export function getGarrisonOperatorConflicts(garrison: Garrison): GarrisonOperatorConflict[] {
  const stagesByOperator = new Map<string, GarrisonStage[]>()
  const firstSeenOrder: string[] = []

  for (const stage of garrison.stages) {
    for (const operatorId of new Set(normalizeGarrisonStageOperatorIds(stage.operatorIds))) {
      const stages = stagesByOperator.get(operatorId)
      if (stages) stages.push(stage)
      else {
        firstSeenOrder.push(operatorId)
        stagesByOperator.set(operatorId, [stage])
      }
    }
  }

  return firstSeenOrder.flatMap((operatorId) => {
    const stages = stagesByOperator.get(operatorId) ?? []
    if (stages.length <= 1) return []
    return [
      {
        operatorId,
        stageIds: stages.map((stage) => stage.id),
        stageNames: stages.map((stage) => stage.name),
      },
    ]
  })
}

export function getGarrisonConflictOperatorIds(garrison: Garrison): string[] {
  return getGarrisonOperatorConflicts(garrison).map(({ operatorId }) => operatorId)
}

export function garrisonHasOperatorConflicts(garrison: Garrison): boolean {
  return getGarrisonOperatorConflicts(garrison).length > 0
}

/**
 * Explicit conflict-resolution helper. The first stage in document order keeps
 * each duplicated operator and subsequent stages release it.
 */
export function clearGarrisonOperatorConflicts(garrison: Garrison): Garrison {
  const next = cloneGarrison(garrison)
  const seen = new Set<string>()

  next.stages = next.stages.map((stage) => ({
    ...stage,
    operatorIds: stage.operatorIds.filter((operatorId) => {
      if (seen.has(operatorId)) return false
      seen.add(operatorId)
      return true
    }),
  }))

  return next
}

/** Move a stage without changing its ID or assignments. Invalid moves are no-ops. */
export function reorderGarrisonStages(
  garrison: Garrison,
  movingStageId: string,
  targetStageId: string,
  placement: 'before' | 'after',
): Garrison {
  const from = garrison.stages.findIndex((stage) => stage.id === movingStageId)
  const target = garrison.stages.findIndex((stage) => stage.id === targetStageId)
  if (from < 0 || target < 0 || from === target) return cloneGarrison(garrison)
  const next = cloneGarrison(garrison)
  const [moving] = next.stages.splice(from, 1)
  const targetIndex = next.stages.findIndex((stage) => stage.id === targetStageId)
  next.stages.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, moving)
  return next
}
