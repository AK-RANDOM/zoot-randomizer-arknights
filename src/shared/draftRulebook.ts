import {
  DRAFT_OFFER_SIZE,
  resolveDraftConfiguration,
  validateDraftConfiguration,
  type DraftCapacityRules,
  type DraftEconomyRules,
  type PartialDraftActionRules,
  type ResolvedDraftConfiguration,
} from './draft'
import type { DraftPullDistribution } from './draftDistribution'
import {
  operatorClasses,
  operatorRarities,
  type OperatorClass,
  type OperatorRarity,
} from './operator'

export const DRAFT_RULEBOOK_SCHEMA_VERSION = 1 as const
export const STANDARD_DRAFT_RULEBOOK_ID = 'builtin:standard-draft' as const

export interface DraftRulebookIdentifier {
  id: string
  name: string
  description: string
  createdAt: string
  revision: string
}

export type DraftRulebookSelector =
  | { type: 'operators'; operatorIds: string[] }
  | { type: 'rarities'; rarities: OperatorRarity[] }
  | { type: 'classes'; classes: OperatorClass[] }
  | { type: 'subclasses'; subclassIds: string[] }
  | { type: 'factions'; factionIds: string[] }
  | { type: 'races'; raceIds: string[] }

/**
 * A selector matches any value within that selector. allOf / anyOf / noneOf
 * define how selector groups compose. Resolution against a dataset belongs to M4.
 */
export interface DraftRulebookEligibility {
  allOf: DraftRulebookSelector[]
  anyOf: DraftRulebookSelector[]
  noneOf: DraftRulebookSelector[]
}

export type DraftRulebookPool =
  | { source: 'inherit-global' }
  | { source: 'global-restrictions'; eligibility: DraftRulebookEligibility }
  | { source: 'rulebook-pool'; eligibility: DraftRulebookEligibility }

export type DraftRulebookEconomyRules = Omit<Partial<DraftEconomyRules>, 'operatorCostOverrides'>

export interface DraftRulebookGeneralRules {
  offerSize: number
  actionRules?: PartialDraftActionRules
  capacityRules?: Partial<DraftCapacityRules>
  economyRules?: DraftRulebookEconomyRules
  pullDistribution?: DraftPullDistribution
}

export interface DraftRulebookOverrides {
  operatorCosts: Record<string, number>
}

export interface DraftRulebookAnchorInteraction {
  id: string
  type: 'anchor'
  source: DraftRulebookSelector
  target: DraftRulebookSelector
  modifier: number
}

export interface DraftRulebookProgressiveInteraction {
  id: string
  type: 'progressive'
  group: DraftRulebookSelector
  steps: Array<{ memberCount: number; modifier: number }>
}

export interface DraftRulebookThresholdInteraction {
  id: string
  type: 'threshold'
  group: DraftRulebookSelector
  threshold: number
  modifier: number
  anchor?: DraftRulebookSelector
}

export type DraftRulebookInteraction =
  | DraftRulebookAnchorInteraction
  | DraftRulebookProgressiveInteraction
  | DraftRulebookThresholdInteraction

export interface DraftRulebook {
  schemaVersion: typeof DRAFT_RULEBOOK_SCHEMA_VERSION
  identifier: DraftRulebookIdentifier
  generalRules: DraftRulebookGeneralRules
  pool: DraftRulebookPool
  overrides: DraftRulebookOverrides
  interactions: DraftRulebookInteraction[]
}

export interface DraftRulebookValidationResult {
  valid: boolean
  errors: string[]
}

export interface ResolvedDraftRulebook {
  id: string
  name: string
  revision: string
  offerSize: number
  configuration: ResolvedDraftConfiguration
  pool: DraftRulebookPool
  interactions: DraftRulebookInteraction[]
}

export const STANDARD_DRAFT_RULEBOOK: DraftRulebook = {
  schemaVersion: DRAFT_RULEBOOK_SCHEMA_VERSION,
  identifier: {
    id: STANDARD_DRAFT_RULEBOOK_ID,
    name: 'Standard Draft',
    description: 'Plain pick 1 of 3 using the current Global Pool.',
    createdAt: '2026-10-05T00:00:00.000Z',
    revision: '1',
  },
  generalRules: {
    offerSize: DRAFT_OFFER_SIZE,
    pullDistribution: { type: 'equal' },
  },
  pool: { source: 'inherit-global' },
  overrides: { operatorCosts: {} },
  interactions: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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
  requireValue = true,
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`)
    return
  }
  if (requireValue && value.length === 0) errors.push(`${path} must be a non-empty array.`)
  const seen = new Set<string>()
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item)) errors.push(`${path}[${index}] must be a non-empty string.`)
    else if (seen.has(item)) errors.push(`${path} must not contain duplicate value ${item}.`)
    else seen.add(item)
  }
}

function validateSelector(value: unknown, path: string, errors: string[]): void {
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

function validateEligibility(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(value, ['allOf', 'anyOf', 'noneOf'], path, errors)
  for (const key of ['allOf', 'anyOf', 'noneOf'] as const) {
    const selectors = value[key]
    if (!Array.isArray(selectors)) {
      errors.push(`${path}.${key} must be an array.`)
      continue
    }
    selectors.forEach((selector, index) =>
      validateSelector(selector, `${path}.${key}[${index}]`, errors),
    )
  }
}

function validatePool(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.pool must be an object.')
    return
  }
  if (value.source === 'inherit-global') {
    checkKeys(value, ['source'], 'rulebook.pool', errors)
    return
  }
  if (value.source === 'global-restrictions' || value.source === 'rulebook-pool') {
    checkKeys(value, ['source', 'eligibility'], 'rulebook.pool', errors)
    validateEligibility(value.eligibility, 'rulebook.pool.eligibility', errors)
    return
  }
  errors.push('rulebook.pool.source must be inherit-global, global-restrictions, or rulebook-pool.')
}

function validateRateUp(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(value, ['share', 'featuredOperatorIds'], path, errors)
  if (!finiteNumber(value.share) || value.share < 0 || value.share > 1) {
    errors.push(`${path}.share must be between 0 and 1.`)
  }
  validateStringList(value.featuredOperatorIds, `${path}.featuredOperatorIds`, errors, false)
}

function validateDistribution(value: unknown, errors: string[]): void {
  const path = 'rulebook.generalRules.pullDistribution'
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  if (value.type === 'equal') {
    checkKeys(value, ['type'], path, errors)
    return
  }
  if (value.type === 'arknights') {
    checkKeys(value, ['type', 'rateUps'], path, errors)
    if (value.rateUps !== undefined) {
      if (!isRecord(value.rateUps)) errors.push(`${path}.rateUps must be an object.`)
      else {
        for (const [bucketId, rateUp] of Object.entries(value.rateUps)) {
          validateRateUp(rateUp, `${path}.rateUps.${bucketId}`, errors)
        }
      }
    }
    return
  }
  if (value.type !== 'custom') {
    errors.push(`${path}.type must be equal, arknights, or custom.`)
    return
  }

  checkKeys(value, ['type', 'buckets'], path, errors)
  if (!Array.isArray(value.buckets)) {
    errors.push(`${path}.buckets must be an array.`)
    return
  }
  const bucketIds = new Set<string>()
  const rarityMembership = new Map<number, string>()
  let hasPositiveBucket = false
  value.buckets.forEach((bucket, index) => {
    const bucketPath = `${path}.buckets[${index}]`
    if (!isRecord(bucket)) {
      errors.push(`${bucketPath} must be an object.`)
      return
    }
    checkKeys(bucket, ['id', 'weight', 'rarities', 'rateUp'], bucketPath, errors)
    if (!nonEmptyString(bucket.id)) errors.push(`${bucketPath}.id must be a non-empty string.`)
    else if (bucketIds.has(bucket.id)) errors.push(`${path}.buckets must use unique IDs; duplicate ${bucket.id}.`)
    else bucketIds.add(bucket.id)
    if (!finiteNumber(bucket.weight) || bucket.weight < 0) {
      errors.push(`${bucketPath}.weight must be a non-negative finite number.`)
    }
    if (!Array.isArray(bucket.rarities)) {
      errors.push(`${bucketPath}.rarities must be an array.`)
    } else {
      if (finiteNumber(bucket.weight) && bucket.weight > 0 && bucket.rarities.length > 0) {
        hasPositiveBucket = true
      }
      for (const rarity of bucket.rarities) {
        if (!operatorRarities.includes(rarity as OperatorRarity)) {
          errors.push(`${bucketPath} contains unsupported rarity ${String(rarity)}.`)
          continue
        }
        const existing = rarityMembership.get(rarity as number)
        if (existing) {
          errors.push(`${path}: rarity ${String(rarity)} belongs to multiple buckets: ${existing}, ${String(bucket.id)}.`)
        } else {
          rarityMembership.set(rarity as number, String(bucket.id))
        }
      }
    }
    if (bucket.rateUp !== undefined) validateRateUp(bucket.rateUp, `${bucketPath}.rateUp`, errors)
  })
  for (const rarity of operatorRarities) {
    if (!rarityMembership.has(rarity)) {
      errors.push(`${path}: rarity ${rarity} must belong to exactly one custom bucket.`)
    }
  }
  if (!hasPositiveBucket) {
    errors.push(`${path} requires at least one non-empty positive-weight bucket.`)
  }
}

function validateGeneralRules(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.generalRules must be an object.')
    return
  }
  checkKeys(
    value,
    ['offerSize', 'actionRules', 'capacityRules', 'economyRules', 'pullDistribution'],
    'rulebook.generalRules',
    errors,
  )
  if (!Number.isInteger(value.offerSize) || (value.offerSize as number) < 1) {
    errors.push('rulebook.generalRules.offerSize must be a positive integer.')
  } else if (value.offerSize !== DRAFT_OFFER_SIZE) {
    errors.push(
      `rulebook.generalRules.offerSize ${String(value.offerSize)} is not supported by this app; expected ${DRAFT_OFFER_SIZE}.`,
    )
  }
  if (value.pullDistribution !== undefined) validateDistribution(value.pullDistribution, errors)

  if (value.economyRules !== undefined) {
    if (!isRecord(value.economyRules)) errors.push('rulebook.generalRules.economyRules must be an object.')
    else {
      checkKeys(
        value.economyRules,
        ['enabled', 'startingPoints', 'rarityCosts', 'forfeitRebate', 'rerollCost', 'holdCost', 'slotExpansionCost'],
        'rulebook.generalRules.economyRules',
        errors,
      )
      if ('operatorCostOverrides' in value.economyRules) {
        errors.push('rulebook.generalRules.economyRules.operatorCostOverrides belongs in rulebook.overrides.')
      }
      for (const key of ['startingPoints', 'forfeitRebate', 'rerollCost', 'holdCost', 'slotExpansionCost'] as const) {
        const amount = value.economyRules[key]
        if (amount !== undefined && (!finiteNumber(amount) || amount < 0)) {
          errors.push(`rulebook.generalRules.economyRules.${key} must be a non-negative finite number.`)
        }
      }
      if (value.economyRules.rarityCosts !== undefined) {
        if (!isRecord(value.economyRules.rarityCosts)) {
          errors.push('rulebook.generalRules.economyRules.rarityCosts must be an object.')
        } else {
          for (const [rarity, cost] of Object.entries(value.economyRules.rarityCosts)) {
            if (!operatorRarities.includes(Number(rarity) as OperatorRarity)) {
              errors.push(`rulebook.generalRules.economyRules.rarityCosts.${rarity} uses an unsupported rarity.`)
            }
            if (!finiteNumber(cost)) {
              errors.push(`rulebook.generalRules.economyRules.rarityCosts.${rarity} must be a finite number.`)
            }
          }
        }
      }
    }
  }
}

function validateIdentifier(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.identifier must be an object.')
    return
  }
  checkKeys(value, ['id', 'name', 'description', 'createdAt', 'revision'], 'rulebook.identifier', errors)
  for (const key of ['id', 'name', 'revision'] as const) {
    if (!nonEmptyString(value[key])) errors.push(`rulebook.identifier.${key} must be a non-empty string.`)
  }
  if (typeof value.description !== 'string') errors.push('rulebook.identifier.description must be a string.')
  if (typeof value.createdAt !== 'string') {
    errors.push('rulebook.identifier.createdAt must be a canonical ISO-8601 timestamp.')
  } else {
    const createdAt = new Date(value.createdAt)
    if (Number.isNaN(createdAt.valueOf()) || createdAt.toISOString() !== value.createdAt) {
      errors.push('rulebook.identifier.createdAt must be a canonical ISO-8601 timestamp.')
    }
  }
}

function validateOverrides(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.overrides must be an object.')
    return
  }
  checkKeys(value, ['operatorCosts'], 'rulebook.overrides', errors)
  if (!isRecord(value.operatorCosts)) {
    errors.push('rulebook.overrides.operatorCosts must be an object.')
    return
  }
  for (const [operatorId, cost] of Object.entries(value.operatorCosts)) {
    if (!nonEmptyString(operatorId) || !finiteNumber(cost)) {
      errors.push(`rulebook.overrides.operatorCosts.${operatorId} must be a finite number.`)
    }
  }
}

function validateInteractions(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push('rulebook.interactions must be an array.')
    return
  }
  const ids = new Set<string>()
  value.forEach((interaction, index) => {
    const path = `rulebook.interactions[${index}]`
    if (!isRecord(interaction)) {
      errors.push(`${path} must be an object.`)
      return
    }
    if (!nonEmptyString(interaction.id)) errors.push(`${path}.id must be a non-empty string.`)
    else if (ids.has(interaction.id)) errors.push(`rulebook.interactions must use unique IDs; duplicate ${interaction.id}.`)
    else ids.add(interaction.id)

    if (interaction.type === 'anchor') {
      checkKeys(interaction, ['id', 'type', 'source', 'target', 'modifier'], path, errors)
      validateSelector(interaction.source, `${path}.source`, errors)
      validateSelector(interaction.target, `${path}.target`, errors)
      if (!finiteNumber(interaction.modifier) || interaction.modifier < 0) {
        errors.push(`${path}.modifier must be a non-negative finite number.`)
      }
      return
    }
    if (interaction.type === 'progressive') {
      checkKeys(interaction, ['id', 'type', 'group', 'steps'], path, errors)
      validateSelector(interaction.group, `${path}.group`, errors)
      if (!Array.isArray(interaction.steps) || interaction.steps.length === 0) {
        errors.push(`${path}.steps must be a non-empty array.`)
        return
      }
      let previousCount = 0
      interaction.steps.forEach((step, stepIndex) => {
        const stepPath = `${path}.steps[${stepIndex}]`
        if (!isRecord(step)) {
          errors.push(`${stepPath} must be an object.`)
          return
        }
        checkKeys(step, ['memberCount', 'modifier'], stepPath, errors)
        if (!Number.isInteger(step.memberCount) || (step.memberCount as number) <= previousCount) {
          errors.push(`${stepPath}.memberCount must be a positive, strictly increasing integer.`)
        } else previousCount = step.memberCount as number
        if (!finiteNumber(step.modifier) || step.modifier < 0) {
          errors.push(`${stepPath}.modifier must be a non-negative finite number.`)
        }
      })
      return
    }
    if (interaction.type === 'threshold') {
      checkKeys(interaction, ['id', 'type', 'group', 'threshold', 'modifier', 'anchor'], path, errors)
      validateSelector(interaction.group, `${path}.group`, errors)
      if (!Number.isInteger(interaction.threshold) || (interaction.threshold as number) < 1) {
        errors.push(`${path}.threshold must be a positive integer.`)
      }
      if (!finiteNumber(interaction.modifier) || interaction.modifier < 0) {
        errors.push(`${path}.modifier must be a non-negative finite number.`)
      }
      if (interaction.anchor !== undefined) validateSelector(interaction.anchor, `${path}.anchor`, errors)
      return
    }
    errors.push(`${path}.type must be anchor, progressive, or threshold.`)
  })
}

export function validateDraftRulebook(value: unknown): DraftRulebookValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { valid: false, errors: ['Draft Rulebook must be an object.'] }

  checkKeys(
    value,
    ['schemaVersion', 'identifier', 'generalRules', 'pool', 'overrides', 'interactions'],
    'rulebook',
    errors,
  )
  if (value.schemaVersion !== DRAFT_RULEBOOK_SCHEMA_VERSION) {
    errors.push(`rulebook.schemaVersion must be ${DRAFT_RULEBOOK_SCHEMA_VERSION}.`)
  }
  validateIdentifier(value.identifier, errors)
  validateGeneralRules(value.generalRules, errors)
  validatePool(value.pool, errors)
  validateOverrides(value.overrides, errors)
  validateInteractions(value.interactions, errors)

  if (errors.length === 0) {
    const rulebook = value as unknown as DraftRulebook
    try {
      validateDraftConfiguration(
        resolveDraftConfiguration({
          actionRules: rulebook.generalRules.actionRules,
          capacityRules: rulebook.generalRules.capacityRules,
          economyRules: {
            ...rulebook.generalRules.economyRules,
            operatorCostOverrides: rulebook.overrides.operatorCosts,
          },
          pullDistribution: rulebook.generalRules.pullDistribution,
        }),
      )
    } catch (reason) {
      errors.push(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return { valid: errors.length === 0, errors }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function assertValidRulebook(value: unknown): asserts value is DraftRulebook {
  const validation = validateDraftRulebook(value)
  if (!validation.valid) {
    throw new Error(`Invalid Draft Rulebook: ${validation.errors.join(' ')}`)
  }
}

export function resolveDraftRulebook(rulebook: DraftRulebook): ResolvedDraftRulebook {
  assertValidRulebook(rulebook)
  const configuration = resolveDraftConfiguration({
    actionRules: rulebook.generalRules.actionRules,
    capacityRules: rulebook.generalRules.capacityRules,
    economyRules: {
      ...rulebook.generalRules.economyRules,
      operatorCostOverrides: { ...rulebook.overrides.operatorCosts },
    },
    pullDistribution: rulebook.generalRules.pullDistribution,
  })
  validateDraftConfiguration(configuration)

  return {
    id: rulebook.identifier.id,
    name: rulebook.identifier.name,
    revision: rulebook.identifier.revision,
    offerSize: rulebook.generalRules.offerSize,
    configuration,
    pool: cloneJson(rulebook.pool),
    interactions: cloneJson(rulebook.interactions),
  }
}

export function serializeDraftRulebook(rulebook: DraftRulebook): string {
  assertValidRulebook(rulebook)
  return `${JSON.stringify(rulebook, null, 2)}\n`
}

export function deserializeDraftRulebook(serialized: string): DraftRulebook {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    throw new Error('Draft Rulebook file is not valid JSON.')
  }
  assertValidRulebook(parsed)
  return cloneJson(parsed)
}

export function createEmptyDraftRulebookEligibility(): DraftRulebookEligibility {
  return { allOf: [], anyOf: [], noneOf: [] }
}
