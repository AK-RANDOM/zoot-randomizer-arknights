import type { DraftRulebook, DraftRulebookValidationResult } from './types'
import { validateDraftRulebook as validateBaseDraftRulebook } from './validation'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneForBaseValidation(value: unknown): unknown {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as unknown
}

export function validateDraftRulebook(value: unknown): DraftRulebookValidationResult {
  const cloned = cloneForBaseValidation(value)

  if (isRecord(cloned)) {
    const generalRules = cloned.generalRules
    if (isRecord(generalRules)) {
      const actionRules = generalRules.actionRules
      if (isRecord(actionRules) && isRecord(actionRules.hold)) {
        delete actionRules.hold.upkeepMode
        delete actionRules.hold.upkeepBaseCost
        delete actionRules.hold.upkeepEscalation
      }
    }
  }

  const base = validateBaseDraftRulebook(cloned)
  const errors = [...base.errors]

  if (isRecord(value)) {
    const generalRules = value.generalRules
    if (isRecord(generalRules)) {
      const actionRules = generalRules.actionRules
      if (isRecord(actionRules) && isRecord(actionRules.hold)) {
        const originalHold = actionRules.hold
        const mode = originalHold.upkeepMode
        if (mode !== undefined && mode !== 'none' && mode !== 'static' && mode !== 'escalating') {
          errors.push('rulebook.generalRules.actionRules.hold.upkeepMode must be none, static, or escalating.')
        }
        for (const key of ['upkeepBaseCost', 'upkeepEscalation'] as const) {
          const amount = originalHold[key]
          if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
            errors.push(`rulebook.generalRules.actionRules.hold.${key} must be a non-negative finite number.`)
          }
        }
      }
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
