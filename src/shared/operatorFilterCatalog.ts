import {
  operatorClasses,
  type Operator,
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

export interface RaceFilterOption extends OperatorFilterOption {
  operatorCount: number
}
export type RaceFilterGroupKey = 'common' | 'rare' | 'oneOff'
export interface RaceFilterGroup {
  key: RaceFilterGroupKey
  label: string
  races: RaceFilterOption[]
}

export interface FactionNode {
  id: string
  name: string
  children: FactionNode[]
}

export function descendantFactionIds(node: FactionNode): string[] {
  return [node.id, ...node.children.flatMap(descendantFactionIds)]
}

export function factionNodeState(
  node: FactionNode,
  excluded: ReadonlySet<string>,
): {
  allEnabled: boolean
  mixed: boolean
} {
  const ids = descendantFactionIds(node)
  const enabledCount = ids.filter((id) => !excluded.has(id)).length
  const allEnabled = enabledCount === ids.length
  return { allEnabled, mixed: enabledCount > 0 && !allEnabled }
}

/** Original CN debut; same-day branches (including launch) are alphabetical. */
export function buildSubclassFilterOptions(
  operators: readonly Operator[],
  referenceOperators: readonly Operator[] = operators,
): OperatorFilterOption[] {
  const debutDates = new Map<string, string>()
  for (const operator of referenceOperators) {
    const date = operator.availableOn?.cn ? operator.release?.cn?.date : null
    if (!date) continue
    const id = operator.subclass.id
    const previous = debutDates.get(id)
    if (!previous || date < previous) debutDates.set(id, date)
  }
  const subclasses = new Map(
    operators.map((operator) => [operator.subclass.id, operator.subclass.name]),
  )
  return [...subclasses]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => {
      const leftDate = debutDates.get(left.id)
      const rightDate = debutDates.get(right.id)
      if (leftDate !== rightDate) {
        if (!leftDate) return 1
        if (!rightDate) return -1
        return leftDate.localeCompare(rightDate)
      }
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    })
}

export function buildSubclassFilterGroups(
  dataset: { operators: readonly Operator[] },
  referenceOperators: readonly Operator[] = dataset.operators,
): SubclassFilterGroup[] {
  return operatorClasses.map((operatorClass) => ({
    operatorClass,
    subclasses: buildSubclassFilterOptions(
      dataset.operators.filter((operator) => operator.class === operatorClass),
      referenceOperators,
    ),
  }))
}

/** Every race identity, including entries whose display labels are hidden. */
export function buildRaceFilterIds(dataset: OperatorDataset): string[] {
  return [...new Set(dataset.operators.flatMap((operator) => operatorRaceIds(operator)))]
}

export function buildRaceFilterOptions(dataset: OperatorDataset): RaceFilterOption[] {
  const counts = new Map<string, number>()
  for (const operator of dataset.operators) {
    for (const raceId of new Set(operatorRaceIds(operator)))
      counts.set(raceId, (counts.get(raceId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, operatorCount]) => ({
      id,
      name: dataset.raceLabels?.[id] ?? id,
      operatorCount,
    }))
    .filter(
      ({ name, operatorCount }) =>
        operatorCount > 0 &&
        name.trim().length > 0 &&
        name.trim().toLocaleLowerCase() !== 'untranslated',
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function buildRaceFilterGroups(dataset: OperatorDataset): RaceFilterGroup[] {
  const races = buildRaceFilterOptions(dataset)
  return [
    {
      key: 'common',
      label: 'Common',
      races: races.filter(({ operatorCount }) => operatorCount >= 5),
    },
    {
      key: 'rare',
      label: 'Rare',
      races: races.filter(({ operatorCount }) => operatorCount >= 2 && operatorCount <= 4),
    },
    {
      key: 'oneOff',
      label: 'One-off',
      races: races.filter(({ operatorCount }) => operatorCount === 1),
    },
  ]
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

  const dublinnId = Object.entries(dataset.factionLabels).find(
    ([, label]) => label === 'Dublinn',
  )?.[0]
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
      .sort((left, right) =>
        (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right),
      )
    return {
      id,
      name: dataset.factionLabels[id] ?? id,
      children: childIds.map((child) => nodeFor(child, nextSeen)),
    }
  }

  return [...displayedIds]
    .filter((id) => !parentByChild.has(id))
    .sort((left, right) =>
      (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right),
    )
    .map((id) => nodeFor(id))
}
