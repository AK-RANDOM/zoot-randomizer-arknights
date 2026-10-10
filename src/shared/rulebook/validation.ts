import { resolveDraftConfiguration, validateDraftConfiguration } from '../draft'
import { operatorRarities, type OperatorRarity } from '../operator'
import {
  DRAFT_RULEBOOK_SCHEMA_VERSION,
  type DraftRulebook,
  type DraftRulebookValidationResult,
} from './types'
import { validateDraftRulebookEligibility, validateDraftRulebookSelector } from './selectors'

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
    validateDraftRulebookEligibility(value.eligibility, 'rulebook.pool.eligibility', errors)
    return
  }
  errors.push('rulebook.pool.source must be inherit-global, global-restrictions, or rulebook-pool.')
}

function validateLimitedAction(
  value: unknown,
  path: string,
  errors: string[],
  extraBoolean?: 'discardOffer' | 'discardUnheldOffer',
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  const keys = ['enabled', 'perRoundLimit', 'perDraftLimit', 'cooldownRounds']
  if (extraBoolean) keys.push(extraBoolean)
  checkKeys(value, keys, path, errors)
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    errors.push(`${path}.enabled must be boolean.`)
  }
  for (const key of ['perRoundLimit', 'perDraftLimit'] as const) {
    const limit = value[key]
    if (
      limit !== undefined &&
      limit !== null &&
      (!Number.isInteger(limit) || (limit as number) < 1)
    ) {
      errors.push(`${path}.${key} must be null or a positive integer.`)
    }
  }
  if (
    value.cooldownRounds !== undefined &&
    (!Number.isInteger(value.cooldownRounds) || (value.cooldownRounds as number) < 0)
  ) {
    errors.push(`${path}.cooldownRounds must be a non-negative integer.`)
  }
  if (
    extraBoolean &&
    value[extraBoolean] !== undefined &&
    typeof value[extraBoolean] !== 'boolean'
  ) {
    errors.push(`${path}.${extraBoolean} must be boolean.`)
  }
}

function validateActionRules(value: unknown, errors: string[]): void {
  const path = 'rulebook.generalRules.actionRules'
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(value, ['hold', 'forfeit', 'reroll', 'slotExpansion'], path, errors)
  if (value.hold !== undefined)
    validateLimitedAction(value.hold, `${path}.hold`, errors, 'discardUnheldOffer')
  if (value.forfeit !== undefined)
    validateLimitedAction(value.forfeit, `${path}.forfeit`, errors, 'discardOffer')
  if (value.reroll !== undefined)
    validateLimitedAction(value.reroll, `${path}.reroll`, errors, 'discardOffer')
  if (value.slotExpansion !== undefined)
    validateLimitedAction(value.slotExpansion, `${path}.slotExpansion`, errors)
}

function validateCapacityRules(value: unknown, errors: string[]): void {
  const path = 'rulebook.generalRules.capacityRules'
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(
    value,
    ['enabled', 'startingActiveSlots', 'overflowSlots', 'maxActiveSlots'],
    path,
    errors,
  )
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean')
    errors.push(`${path}.enabled must be boolean.`)
  for (const key of ['startingActiveSlots', 'overflowSlots', 'maxActiveSlots'] as const) {
    const count = value[key]
    if (count !== undefined && (!Number.isInteger(count) || (count as number) < 0)) {
      errors.push(`${path}.${key} must be a non-negative integer.`)
    }
  }
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
    checkKeys(value, ['type', 'rateUps', 'firstTenActualFiveStarGuarantee'], path, errors)
    if (
      value.firstTenActualFiveStarGuarantee !== undefined &&
      typeof value.firstTenActualFiveStarGuarantee !== 'boolean'
    ) {
      errors.push(`${path}.firstTenActualFiveStarGuarantee must be boolean.`)
    }
    if (value.rateUps !== undefined) {
      if (!isRecord(value.rateUps)) errors.push(`${path}.rateUps must be an object.`)
      else
        for (const [bucketId, rateUp] of Object.entries(value.rateUps)) {
          validateRateUp(rateUp, `${path}.rateUps.${bucketId}`, errors)
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
    else if (bucketIds.has(bucket.id))
      errors.push(`${path}.buckets must use unique IDs; duplicate ${bucket.id}.`)
    else bucketIds.add(bucket.id)
    if (!finiteNumber(bucket.weight) || bucket.weight < 0) {
      errors.push(`${bucketPath}.weight must be a non-negative finite number.`)
    }
    if (!Array.isArray(bucket.rarities)) errors.push(`${bucketPath}.rarities must be an array.`)
    else {
      if (finiteNumber(bucket.weight) && bucket.weight > 0 && bucket.rarities.length > 0)
        hasPositiveBucket = true
      for (const rarity of bucket.rarities) {
        if (!operatorRarities.includes(rarity as OperatorRarity)) {
          errors.push(`${bucketPath} contains unsupported rarity ${String(rarity)}.`)
          continue
        }
        const existing = rarityMembership.get(rarity as number)
        if (existing) {
          errors.push(
            `${path}: rarity ${String(rarity)} belongs to multiple buckets: ${existing}, ${String(bucket.id)}.`,
          )
        } else rarityMembership.set(rarity as number, String(bucket.id))
      }
    }
    if (bucket.rateUp !== undefined) validateRateUp(bucket.rateUp, `${bucketPath}.rateUp`, errors)
  })
  for (const rarity of operatorRarities) {
    if (!rarityMembership.has(rarity))
      errors.push(`${path}: rarity ${rarity} must belong to exactly one custom bucket.`)
  }
  if (!hasPositiveBucket)
    errors.push(`${path} requires at least one non-empty positive-weight bucket.`)
}

function validateHoldUpkeep(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  if (value.mode === 'none') {
    checkKeys(value, ['mode'], path, errors)
    return
  }
  if (value.mode === 'static') {
    checkKeys(value, ['mode', 'cost'], path, errors)
    if (!finiteNumber(value.cost) || value.cost < 0) {
      errors.push(`${path}.cost must be a non-negative finite number.`)
    }
    return
  }
  if (value.mode === 'escalating') {
    checkKeys(value, ['mode', 'baseCost', 'escalation'], path, errors)
    if (!finiteNumber(value.baseCost) || value.baseCost < 0) {
      errors.push(`${path}.baseCost must be a non-negative finite number.`)
    }
    if (!finiteNumber(value.escalation) || value.escalation < 0) {
      errors.push(`${path}.escalation must be a non-negative finite number.`)
    }
    return
  }
  if (value.mode === 'schedule') {
    checkKeys(value, ['mode', 'costs', 'repeatLast'], path, errors)
    if (!Array.isArray(value.costs) || value.costs.length === 0) {
      errors.push(`${path}.costs must be a non-empty array.`)
    } else {
      value.costs.forEach((cost, index) => {
        if (!finiteNumber(cost) || cost < 0) {
          errors.push(`${path}.costs[${index}] must be a non-negative finite number.`)
        }
      })
    }
    if (typeof value.repeatLast !== 'boolean') {
      errors.push(`${path}.repeatLast must be boolean.`)
    }
    return
  }
  errors.push(`${path}.mode must be none, static, escalating, or schedule.`)
}

function validateEconomyRules(value: unknown, errors: string[]): void {
  const path = 'rulebook.generalRules.economyRules'
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  checkKeys(
    value,
    [
      'enabled',
      'startingPoints',
      'rarityCosts',
      'forfeitRebate',
      'rerollCost',
      'holdCost',
      'holdUpkeep',
      'slotExpansionCost',
    ],
    path,
    errors,
  )
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean')
    errors.push(`${path}.enabled must be boolean.`)
  for (const key of [
    'startingPoints',
    'forfeitRebate',
    'rerollCost',
    'holdCost',
    'slotExpansionCost',
  ] as const) {
    const amount = value[key]
    if (amount !== undefined && (!finiteNumber(amount) || amount < 0)) {
      errors.push(`${path}.${key} must be a non-negative finite number.`)
    }
  }
  if (value.holdUpkeep !== undefined) {
    validateHoldUpkeep(value.holdUpkeep, `${path}.holdUpkeep`, errors)
  }
  if (value.rarityCosts !== undefined) {
    if (!isRecord(value.rarityCosts)) errors.push(`${path}.rarityCosts must be an object.`)
    else
      for (const [rarity, cost] of Object.entries(value.rarityCosts)) {
        if (!operatorRarities.includes(Number(rarity) as OperatorRarity)) {
          errors.push(`${path}.rarityCosts.${rarity} uses an unsupported rarity.`)
        }
        if (!finiteNumber(cost))
          errors.push(`${path}.rarityCosts.${rarity} must be a finite number.`)
      }
  }
}

function validateGeneralRules(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.generalRules must be an object.')
    return
  }
  checkKeys(
    value,
    [
      'offerSize',
      'pricingProfileId',
      'maxRounds',
      'actionRules',
      'capacityRules',
      'economyRules',
      'pullDistribution',
    ],
    'rulebook.generalRules',
    errors,
  )
  if (!Number.isInteger(value.offerSize) || (value.offerSize as number) < 1) {
    errors.push('rulebook.generalRules.offerSize must be a positive integer.')
  }
  if (
    value.pricingProfileId !== undefined &&
    value.pricingProfileId !== null &&
    !nonEmptyString(value.pricingProfileId)
  ) {
    errors.push('rulebook.generalRules.pricingProfileId must be null or a non-empty string.')
  }
  if (
    value.maxRounds !== undefined &&
    value.maxRounds !== null &&
    (!Number.isInteger(value.maxRounds) || (value.maxRounds as number) < 1)
  ) {
    errors.push('rulebook.generalRules.maxRounds must be null or a positive integer.')
  }
  if (value.actionRules !== undefined) validateActionRules(value.actionRules, errors)
  if (value.capacityRules !== undefined) validateCapacityRules(value.capacityRules, errors)
  if (value.economyRules !== undefined) validateEconomyRules(value.economyRules, errors)
  if (value.pullDistribution !== undefined) validateDistribution(value.pullDistribution, errors)
}

function validateIdentifier(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('rulebook.identifier must be an object.')
    return
  }
  checkKeys(
    value,
    ['id', 'name', 'description', 'createdAt', 'revision'],
    'rulebook.identifier',
    errors,
  )
  for (const key of ['id', 'name', 'revision'] as const) {
    if (!nonEmptyString(value[key]))
      errors.push(`rulebook.identifier.${key} must be a non-empty string.`)
  }
  if (typeof value.description !== 'string')
    errors.push('rulebook.identifier.description must be a string.')
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
    else if (ids.has(interaction.id))
      errors.push(`rulebook.interactions must use unique IDs; duplicate ${interaction.id}.`)
    else ids.add(interaction.id)

    if (interaction.type === 'anchor') {
      checkKeys(interaction, ['id', 'type', 'source', 'target', 'modifier'], path, errors)
      validateDraftRulebookSelector(interaction.source, `${path}.source`, errors)
      validateDraftRulebookSelector(interaction.target, `${path}.target`, errors)
      if (!finiteNumber(interaction.modifier) || interaction.modifier < 0) {
        errors.push(`${path}.modifier must be a non-negative finite number.`)
      }
      return
    }
    if (interaction.type === 'progressive') {
      checkKeys(interaction, ['id', 'type', 'group', 'steps'], path, errors)
      validateDraftRulebookSelector(interaction.group, `${path}.group`, errors)
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
      checkKeys(
        interaction,
        ['id', 'type', 'group', 'threshold', 'modifier', 'anchor'],
        path,
        errors,
      )
      validateDraftRulebookSelector(interaction.group, `${path}.group`, errors)
      if (!Number.isInteger(interaction.threshold) || (interaction.threshold as number) < 1) {
        errors.push(`${path}.threshold must be a positive integer.`)
      }
      if (!finiteNumber(interaction.modifier) || interaction.modifier < 0) {
        errors.push(`${path}.modifier must be a non-negative finite number.`)
      }
      if (interaction.anchor !== undefined)
        validateDraftRulebookSelector(interaction.anchor, `${path}.anchor`, errors)
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
          offerSize: rulebook.generalRules.offerSize,
          maxRounds: rulebook.generalRules.maxRounds,
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

export function assertValidDraftRulebook(value: unknown): asserts value is DraftRulebook {
  const validation = validateDraftRulebook(value)
  if (!validation.valid) {
    throw new Error(`Invalid Draft Rulebook: ${validation.errors.join(' ')}`)
  }
}
