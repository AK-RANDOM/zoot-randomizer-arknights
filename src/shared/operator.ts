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

export const gameLocales = ['en', 'jp', 'kr', 'tw', 'cn'] as const

export const OPERATOR_DATASET_SCHEMA_VERSION = 6 as const

export type OperatorClass = (typeof operatorClasses)[number]
export type GameLocale = (typeof gameLocales)[number]
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
  /** Explicit source hierarchy, normalized from mainPower when present. */
  nationId?: string | null
  groupId?: string | null
  teamId?: string | null
  /** Nation -> group -> team primary chain. Required in validated schema-v6 data. */
  primary?: string[]
  /** Most-specific ID in the primary chain; null only when upstream has none. */
  main: string | null
  /** All known nation/group/team affiliations, including alternate source references. */
  affiliations: string[]
}

export interface Operator {
  id: string
  name: string
  rarity: OperatorRarity
  class: OperatorClass
  subclass: OperatorSubclass
  faction: OperatorFaction
  /** Stable source-derived race identities. Absent only on pre-M6 schema-v6 datasets. */
  raceIds?: string[]
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
  gamedataJpCommit?: string | null
  gamedataKrCommit?: string | null
  gamedataTwCommit?: string | null
  /** Optional M6 source stamps; absent on pre-Race schema-v6 datasets. */
  gamedataCnHandbookCommit?: string | null
  gamedataEnHandbookCommit?: string | null
  gamedataJpHandbookCommit?: string | null
  gamedataKrHandbookCommit?: string | null
  gamedataTwHandbookCommit?: string | null
  resourcesCommit: string | null
  releaseMetadataCommit: string | null
}

export interface GameStringCatalog {
  operatorNames: Record<string, string>
  classLabels: Record<OperatorClass, string>
  subclassLabels: Record<string, string>
  factionLabels: Record<string, string>
  /** Stable race ID -> localized source-provided display label. */
  raceLabels?: Record<string, string>
}

export type GameStringCatalogs = Record<GameLocale, GameStringCatalog>

export interface OperatorDataset {
  schemaVersion: typeof OPERATOR_DATASET_SCHEMA_VERSION
  generatedAt: string | null
  sources: OperatorDatasetSources
  /** Stable class ID -> current display label. Defaults to English in schema-v6 data. */
  classLabels?: Record<OperatorClass, string>
  /** Stable faction/power ID -> current display label. Defaults to English in the stored dataset. */
  factionLabels: Record<string, string>
  /** Stable race ID -> current display label. Added by M6 and optional on older schema-v6 data. */
  raceLabels?: Record<string, string>
  /** Game-provided display strings by locale. Absent on legacy schema-v4 data. */
  localizations?: GameStringCatalogs
  operators: Operator[]
}
