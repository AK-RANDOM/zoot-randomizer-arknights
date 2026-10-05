import type { DraftRerollRules } from '../../shared/draft'
import type { DraftRulebook } from '../../shared/draftRulebook'

export type RerollMode = 'none' | 'per-round' | 'per-draft' | 'unlimited' | 'advanced'

export function selectorCount(rulebook: DraftRulebook): number {
  if (rulebook.pool.source === 'inherit-global') return 0
  const eligibility = rulebook.pool.eligibility
  return eligibility.allOf.length + eligibility.anyOf.length + eligibility.noneOf.length
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export function parsePositiveLimit(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getRerollMode(rule: DraftRerollRules): RerollMode {
  if (!rule.enabled) return 'none'
  if (rule.perRoundLimit === null && rule.perDraftLimit === null) return 'unlimited'
  if (rule.perRoundLimit !== null && rule.perDraftLimit === null) return 'per-round'
  if (rule.perRoundLimit === null && rule.perDraftLimit !== null) return 'per-draft'
  return 'advanced'
}
