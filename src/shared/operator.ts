export const operatorClasses = [
  'Vanguard',
  'Guard',
  'Defender',
  'Sniper',
  'Caster',
  'Medic',
  'Supporter',
  'Specialist',
] as const

export const operatorRarities = [1, 2, 3, 4, 5, 6] as const

export const limitedAcquisitionGroups = [
  'anniversary',
  'halfAnniversary',
  'cny',
  'summer',
  'collab',
] as const

export const welfareAcquisitionGroups = [
  'eventStory',
  'redCert',
  'cc',
  'isRa',
] as const

export const OPERATOR_DATASET_SCHEMA_VERSION = 4 as const

export type OperatorClass = (typeof operatorClasses)[number]
export type OperatorRarity = (typeof operatorRarities)[number]
export type ReleaseServer = 'cn' | 'global'
export type AcquisitionFamily = 'limited' | 'standard' | 'welfare'
export type LimitedAcquisitionGroup = (typeof limitedAcquisitionGroups)[number]
export type WelfareAcquisitionGroup = (typeof welfareAcquisitionGroups)[number]
export type AcquisitionGroup = LimitedAcquisitionGroup | WelfareAcquisitionGroup | null

export interface OperatorRelease {
  date: string | null
  yearGroup: number | null
}

export interface OperatorAcquisition {
  family: AcquisitionFamily
  group: AcquisitionGroup
}

export interface OperatorSubclass {
  /** Stable game-data subProfessionId. */
  id: string
  /** User-facing English branch label. */
  name: string
}

export interface OperatorFaction {
  /** Canonical main power/faction ID; null only when upstream has none. */
  main: string | null
  /** All known nation/group/team affiliations, including main when present. */
  affiliations: string[]
}

export interface Operator {
  id: string
  name: string
  rarity: OperatorRarity
  class: OperatorClass
  subclass: OperatorSubclass
  faction: OperatorFaction
  availableOn: {
    cn: boolean
    global: boolean
  }
  release: {
    cn: OperatorRelease
    global: OperatorRelease
  }
  acquisition: OperatorAcquisition
  collaboration: string | null
  alterGroup: string | null
  mandatoryExclusivityGroup: string | null
  imageFile: string
}

export interface OperatorDatasetSources {
  gamedataCnCommit: string | null
  gamedataEnCommit: string | null
  resourcesCommit: string | null
  releaseMetadataCommit: string | null
}

export interface OperatorDataset {
  schemaVersion: typeof OPERATOR_DATASET_SCHEMA_VERSION
  generatedAt: string | null
  sources: OperatorDatasetSources
  /** Stable faction/power ID -> English display label. */
  factionLabels: Record<string, string>
  operators: Operator[]
}
