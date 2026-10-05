import type {
  DraftCapacityRules,
  DraftEconomyRules,
  PartialDraftActionRules,
  ResolvedDraftConfiguration,
} from '../draft'
import type { DraftPullDistribution } from '../draftDistribution'
import type { OperatorClass, OperatorRarity } from '../operator'

export const DRAFT_RULEBOOK_SCHEMA_VERSION = 1 as const

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
