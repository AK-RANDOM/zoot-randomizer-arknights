import {
  operatorClasses,
  type OperatorClass,
  type OperatorDataset,
} from './operator'
import { operatorRaceIds } from './raceMetadata'

export interface OperatorFilterOption {
  id: string
  name: string
}

export interface SubclassFilterGroup {
  operatorClass: OperatorClass
  subclasses: OperatorFilterOption[]
}

export interface FactionNode {
  id: string
  name: string
  children: FactionNode[]
}

export function descendantFactionIds(node: FactionNode): string[] {
  return [node.id, ...node.children.flatMap(descendantFactionIds)]
}

export function factionNodeState(node: FactionNode, excluded: ReadonlySet<string>): {
  allEnabled: boolean
  mixed: boolean
} {
  const ids = descendantFactionIds(node)
  const enabledCount = ids.filter((id) => !excluded.has(id)).length
  const allEnabled = enabledCount === ids.length
  return { allEnabled, mixed: enabledCount > 0 && !allEnabled }
}

export function buildSubclassFilterGroups(dataset: OperatorDataset): SubclassFilterGroup[] {
  return operatorClasses.map((operatorClass) => {
    const subclasses = new Map<string, string>()
    for (const operator of dataset.operators) {
      if (operator.class === operatorClass) subclasses.set(operator.subclass.id, operator.subclass.name)
    }
    return {
      operatorClass,
      subclasses: [...subclasses.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }
  })
}

export function buildRaceFilterOptions(dataset: OperatorDataset): OperatorFilterOption[] {
  const ids = new Set<string>()
  for (const operator of dataset.operators) {
    for (const raceId of operatorRaceIds(operator)) ids.add(raceId)
  }
  return [...ids]
    .map((id) => ({ id, name: dataset.raceLabels?.[id] ?? id }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function buildFactionTree(dataset: OperatorDataset): FactionNode[] {
  const parents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  const displayedIds = new Set<string>()

  for (const operator of dataset.operators) {
    for (const factionId of operator.faction.affiliations) displayedIds.add(factionId)
    const chain = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
    for (let index = 0; index < chain.length - 1; index += 1) {
      const parent = chain[index]
      const child = chain[index + 1]
      if (parent === child) continue
      if (!parents.has(child)) parents.set(child, new Set())
      parents.get(child)?.add(parent)
      if (!children.has(parent)) children.set(parent, new Set())
      children.get(parent)?.add(child)
    }
  }

  const dublinnId = Object.entries(dataset.factionLabels).find(([, label]) => label === 'Dublinn')?.[0]
  if (dublinnId) displayedIds.add(dublinnId)

  const parentByChild = new Map<string, string>()
  for (const [child, candidates] of parents) {
    if (candidates.size === 1) parentByChild.set(child, [...candidates][0])
  }

  const nodeFor = (id: string, seen = new Set<string>()): FactionNode => {
    if (seen.has(id)) return { id, name: dataset.factionLabels[id] ?? id, children: [] }
    const nextSeen = new Set(seen).add(id)
    const childIds = [...(children.get(id) ?? [])]
      .filter((child) => displayedIds.has(child) && parentByChild.get(child) === id)
      .sort((left, right) => (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right))
    return {
      id,
      name: dataset.factionLabels[id] ?? id,
      children: childIds.map((child) => nodeFor(child, nextSeen)),
    }
  }

  return [...displayedIds]
    .filter((id) => !parentByChild.has(id))
    .sort((left, right) => (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right))
    .map((id) => nodeFor(id))
}
