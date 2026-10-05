import type { DraftRulebook, DraftRulebookValidationResult } from './types'
import { validateDraftRulebook as validateBaseDraftRulebook } from './validation'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function validateDraftRulebook(value: unknown): DraftRulebookValidationResult {
  const cloned = cloneJson(value)
  let hold: JsonRecord | null = null

  if (isRecord(cloned)) {
    const generalRules = cloned.generalRules
    if (isRecord(generalRules)) {
      const actionRules = generalRules.actionRules
      if (isRecord(actionRules) && isRecord(actionRules.hold)) {
        hold = actionRules.hold
        delete hold.upkeepMode
        delete hold.upkeepBaseCost
        delete hold.upkeepEscalation
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
