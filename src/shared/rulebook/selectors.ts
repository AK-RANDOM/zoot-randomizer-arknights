import {
  operatorClasses,
  operatorRarities,
  type Operator,
  type OperatorClass,
  type OperatorDataset,
  type OperatorRarity,
} from '../operator'
import { operatorRaceIds } from '../raceMetadata'
import type {
  DraftRulebookEligibility,
  DraftRulebookSelector,
} from './types'

export const DRAFT_RULEBOOK_SELECTOR_TYPE_OPTIONS: ReadonlyArray<{
  type: DraftRulebookSelector['type']
  label: string
}> = [
  { type: 'operators', label: 'Operators' },
  { type: 'rarities', label: 'Rarities' },
  { type: 'classes', label: 'Classes' },
  { type: 'subclasses', label: 'Subclasses' },
  { type: 'factions', label: 'Factions' },
  { type: 'races', label: 'Races' },
]

export interface DraftRulebookSelectorOption {
  id: string
  label: string
}

export interface DraftRulebookOperatorSelectorOption extends DraftRulebookSelectorOption {
  rarity: OperatorRarity
}

export interface DraftRulebookClassSelectorOption {
  id: OperatorClass
  label: string
}

export interface DraftRulebookSelectorCatalog {
  operators: DraftRulebookOperatorSelectorOption[]
  rarities: OperatorRarity[]
  classes: DraftRulebookClassSelectorOption[]
  subclasses: DraftRulebookSelectorOption[]
  factions: DraftRulebookSelectorOption[]
  races: DraftRulebookSelectorOption[]
}

function sortedLabelEntries(labels: Readonly<Record<string, string>>): DraftRulebookSelectorOption[] {
  return Object.entries(labels)
    .map(([id, label]) => ({ id, label }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function createDraftRulebookSelectorCatalog(
  dataset: OperatorDataset,
): DraftRulebookSelectorCatalog {
  const subclasses = new Map<string, string>()
  const races = new Set<string>()
  for (const operator of dataset.operators) {
    subclasses.set(operator.subclass.id, operator.subclass.name)
    for (const raceId of operatorRaceIds(operator)) races.add(raceId)
  }

  return {
    operators: [...dataset.operators]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((operator) => ({
        id: operator.id,
        label: operator.name,
        rarity: operator.rarity,
      })),
    rarities: [...operatorRarities],
    classes: operatorClasses.map((operatorClass) => ({
      id: operatorClass,
      label: dataset.classLabels?.[operatorClass] ?? operatorClass,
    })),
    subclasses: [...subclasses.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    factions: sortedLabelEntries(dataset.factionLabels),
    races: [...races]
      .map((id) => ({ id, label: dataset.raceLabels?.[id] ?? id }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  }
}

export function createDefaultDraftRulebookSelector(
  type: DraftRulebookSelector['type'],
  dataset: OperatorDataset,
): DraftRulebookSelector {
  const catalog = createDraftRulebookSelectorCatalog(dataset)
  switch (type) {
    case 'operators':
      return { type, operatorIds: [catalog.operators[0]?.id ?? 'missing:operator'] }
    case 'rarities':
      return { type, rarities: [6] }
    case 'classes':
      return { type, classes: ['Guard'] }
    case 'subclasses':
      return { type, subclassIds: [catalog.subclasses[0]?.id ?? 'missing:subclass'] }
    case 'factions':
      return { type, factionIds: [catalog.factions[0]?.id ?? 'missing:faction'] }
    case 'races':
      return { type, raceIds: [catalog.races[0]?.id ?? 'missing:race'] }
  }
}

function operatorFactionIds(operator: Operator): Set<string> {
  const ids = new Set<string>()
  const faction = operator.faction
  for (const id of [
    faction.nationId,
    faction.groupId,
    faction.teamId,
    faction.main,
    ...(faction.primary ?? []),
    ...faction.affiliations,
  ]) {
    if (id) ids.add(id)
  }
  return ids
}

export function matchesDraftRulebookSelector(
  operator: Operator,
  selector: DraftRulebookSelector,
): boolean {
  switch (selector.type) {
    case 'operators':
      return selector.operatorIds.includes(operator.id)
    case 'rarities':
      return selector.rarities.includes(operator.rarity)
    case 'classes':
      return selector.classes.includes(operator.class)
    case 'subclasses':
      return selector.subclassIds.includes(operator.subclass.id)
    case 'factions': {
      const factionIds = operatorFactionIds(operator)
      return selector.factionIds.some((id) => factionIds.has(id))
    }
    case 'races': {
      const races = new Set(operatorRaceIds(operator))
      return selector.raceIds.some((id) => races.has(id))
    }
  }
}

export function matchesDraftRulebookEligibility(
  operator: Operator,
  eligibility: DraftRulebookEligibility,
): boolean {
  if (!eligibility.allOf.every((selector) => matchesDraftRulebookSelector(operator, selector))) {
    return false
  }
  if (
    eligibility.anyOf.length > 0 &&
    !eligibility.anyOf.some((selector) => matchesDraftRulebookSelector(operator, selector))
  ) {
    return false
  }
  return !eligibility.noneOf.some((selector) => matchesDraftRulebookSelector(operator, selector))
}

export function resolveDraftRulebookSelector(
  operators: readonly Operator[],
  selector: DraftRulebookSelector,
): Operator[] {
  return operators.filter((operator) => matchesDraftRulebookSelector(operator, selector))
}

export function resolveDraftRulebookEligibility(
  operators: readonly Operator[],
  eligibility: DraftRulebookEligibility,
): Operator[] {
  return operators.filter((operator) => matchesDraftRulebookEligibility(operator, eligibility))
}

export interface DraftRulebookDatasetReferences {
  operatorIds: Set<string>
  subclassIds: Set<string>
  factionIds: Set<string>
  raceIds: Set<string>
}

export type DraftRulebookSelectorReferenceKind = 'Operator' | 'Subclass' | 'Faction' | 'Race'

export interface DraftRulebookSelectorReference {
  kind: DraftRulebookSelectorReferenceKind
  id: string
  pathSuffix: string
  resolved: boolean
}

export function createDraftRulebookDatasetReferences(
  dataset: OperatorDataset,
): DraftRulebookDatasetReferences {
  const operatorIds = new Set<string>()
  const subclassIds = new Set<string>()
  const factionIds = new Set(Object.keys(dataset.factionLabels))
  const raceIds = new Set(Object.keys(dataset.raceLabels ?? {}))

  for (const operator of dataset.operators) {
    operatorIds.add(operator.id)
    subclassIds.add(operator.subclass.id)
    for (const id of operatorFactionIds(operator)) factionIds.add(id)
    for (const id of operatorRaceIds(operator)) raceIds.add(id)
  }

  return { operatorIds, subclassIds, factionIds, raceIds }
}

export function inspectDraftRulebookSelectorReferences(
  selector: DraftRulebookSelector,
  references: DraftRulebookDatasetReferences,
): DraftRulebookSelectorReference[] {
  switch (selector.type) {
    case 'operators':
      return selector.operatorIds.map((id, index) => ({
        kind: 'Operator',
        id,
        pathSuffix: `operatorIds[${index}]`,
        resolved: references.operatorIds.has(id),
      }))
    case 'subclasses':
      return selector.subclassIds.map((id, index) => ({
        kind: 'Subclass',
        id,
        pathSuffix: `subclassIds[${index}]`,
        resolved: references.subclassIds.has(id),
      }))
    case 'factions':
      return selector.factionIds.map((id, index) => ({
        kind: 'Faction',
        id,
        pathSuffix: `factionIds[${index}]`,
        resolved: references.factionIds.has(id),
      }))
    case 'races':
      return selector.raceIds.map((id, index) => ({
        kind: 'Race',
        id,
        pathSuffix: `raceIds[${index}]`,
        resolved: references.raceIds.has(id),
      }))
    case 'rarities':
    case 'classes':
      return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  const allowedKeys = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} is not supported.`)
  }
}

function validateStringList(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`)
    return
  }
  if (value.length === 0) errors.push(`${path} must be a non-empty array.`)
  const seen = new Set<string>()
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item)) errors.push(`${path}[${index}] must be a non-empty string.`)
    else if (seen.has(item)) errors.push(`${path} must not contain duplicate value ${item}.`)
    else seen.add(item)
  }
}

export function validateDraftRulebookSelector(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  switch (value.type) {
    case 'operators':
      checkKeys(value, ['type', 'operatorIds'], path, errors)
      validateStringList(value.operatorIds, `${path}.operatorIds`, errors)
      return
    case 'rarities':
      checkKeys(value, ['type', 'rarities'], path, errors)
      if (!Array.isArray(value.rarities) || value.rarities.length === 0) {
        errors.push(`${path}.rarities must be a non-empty array.`)
        return
      }
      for (const [index, rarity] of value.rarities.entries()) {
        if (!operatorRarities.includes(rarity as OperatorRarity)) {
          errors.push(`${path}.rarities[${index}] is not supported.`)
        }
      }
      return
    case 'classes':
      checkKeys(value, ['type', 'classes'], path, errors)
      if (!Array.isArray(value.classes) || value.classes.length === 0) {
        errors.push(`${path}.classes must be a non-empty array.`)
        return
      }
      for (const [index, operatorClass] of value.classes.entries()) {
        if (!operatorClasses.includes(operatorClass as OperatorClass)) {
          errors.push(`${path}.classes[${index}] is not supported.`)
        }
      }
      return
    case 'subclasses':
      checkKeys(value, ['type', 'subclassIds'], path, errors)
      validateStringList(value.subclassIds, `${path}.subclassIds`, errors)
      return
    case 'factions':
      checkKeys(value, ['type', 'factionIds'], path, errors)
      validateStringList(value.factionIds, `${path}.factionIds`, errors)
      return
    case 'races':
      checkKeys(value, ['type', 'raceIds'], path, errors)
      validateStringList(value.raceIds, `${path}.raceIds`, errors)
      return
    default:
      errors.push(`${path}.type is not a supported selector type.`)
  }
}

export function validateDraftRulebookEligibility(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(value, ['allOf', 'anyOf', 'noneOf'], path, errors)
  for (const key of ['allOf', 'anyOf', 'noneOf'] as const) {
    const selectors = value[key]
    if (!Array.isArray(selectors)) errors.push(`${path}.${key} must be an array.`)
    else selectors.forEach((selector, index) =>
      validateDraftRulebookSelector(selector, `${path}.${key}[${index}]`, errors))
  }
}
