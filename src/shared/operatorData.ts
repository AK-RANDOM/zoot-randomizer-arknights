import {
  OPERATOR_DATASET_SCHEMA_VERSION,
  limitedAcquisitionGroups,
  operatorClasses,
  welfareAcquisitionGroups,
  type Operator,
  type OperatorClass,
  type OperatorDataset,
  type OperatorDatasetSources,
  type OperatorFaction,
  type OperatorRarity,
} from './operator.ts'
import {
  classifyAcquisition,
  isModeOnlyOperator,
  limitedOperatorIds,
  type RawGachaTable,
} from './acquisitionMetadata.ts'
import {
  COLLABORATION_BY_OPERATOR_ID,
  RELEASE_METADATA_UPSTREAM,
  buildReleaseCategoryMap,
  buildReleaseDateMap,
  releaseYearGroup,
  type OperatorReleaseCategory,
  type OperatorReleaseDates,
} from './releaseMetadata.ts'
import { KERNEL_CUTOFF_BY_SERVER, SUBCLASS_LABELS } from './operatorMetadata.ts'

export const UPSTREAM = {
  gamedataRepo: 'ArknightsAssets/ArknightsGamedata',
  resourcesRepo: 'yuanyan3060/ArknightsGameResource',
  cnExcelPath: 'cn/gamedata/excel',
  enExcelPath: 'en/gamedata/excel',
  cnCharacterPath: 'cn/gamedata/excel/character_table.json',
  enCharacterPath: 'en/gamedata/excel/character_table.json',
  cnPatchPath: 'cn/gamedata/excel/char_patch_table.json',
  enPatchPath: 'en/gamedata/excel/char_patch_table.json',
  cnCharMetaPath: 'cn/gamedata/excel/char_meta_table.json',
  enCharMetaPath: 'en/gamedata/excel/char_meta_table.json',
  cnGachaPath: 'cn/gamedata/excel/gacha_table.json',
  enHandbookTeamPath: 'en/gamedata/excel/handbook_team_table.json',
  resourceAvatarPath: 'avatar',
  cnCharacterUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/excel/character_table.json',
  enCharacterUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/character_table.json',
  cnPatchUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/excel/char_patch_table.json',
  enPatchUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/char_patch_table.json',
  cnCharMetaUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/excel/char_meta_table.json',
  enCharMetaUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/char_meta_table.json',
  cnGachaUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/excel/gacha_table.json',
  enHandbookTeamUrl:
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/handbook_team_table.json',
  releaseRepo: RELEASE_METADATA_UPSTREAM.repository,
  releaseInfoPath: RELEASE_METADATA_UPSTREAM.infoPath,
  releaseCandidatePath: RELEASE_METADATA_UPSTREAM.candidatePath,
  releaseEventPath: RELEASE_METADATA_UPSTREAM.eventPath,
  releaseInfoUrl: RELEASE_METADATA_UPSTREAM.infoUrl,
  releaseCandidateUrl: RELEASE_METADATA_UPSTREAM.candidateUrl,
  releaseEventUrl: RELEASE_METADATA_UPSTREAM.eventUrl,
  avatarBaseUrl:
    'https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar',
  classIconRepo: 'tohmatosauce/ak-branch-icons',
  classIconRevision: 'e5639fd87cb86f596c3551bda54eff1b2a4dd810',
  classIconBaseUrl:
    'https://raw.githubusercontent.com/tohmatosauce/ak-branch-icons/e5639fd87cb86f596c3551bda54eff1b2a4dd810/svgs/400',
} as const

export const CLASS_ICON_FILES: Record<OperatorClass, string> = {
  Vanguard: 'Vanguard.svg',
  Guard: 'Guard.svg',
  Defender: 'Defender.svg',
  Sniper: 'Sniper.svg',
  Caster: 'Caster.svg',
  Medic: 'Medic.svg',
  Supporter: 'Supporter.svg',
  Specialist: 'Specialist.svg',
}

export interface RawPowerReference {
  nationId?: unknown
  groupId?: unknown
  teamId?: unknown
}

export interface RawCharacterRecord {
  name?: unknown
  appellation?: unknown
  rarity?: unknown
  profession?: unknown
  subProfessionId?: unknown
  isNotObtainable?: unknown
  itemObtainApproach?: unknown
  nationId?: unknown
  groupId?: unknown
  teamId?: unknown
  mainPower?: unknown
}

export type RawCharacterTable = Record<string, RawCharacterRecord>

export interface RawCharacterPatchTable {
  patchChars?: RawCharacterTable
}

export interface RawCharacterMetaTable {
  spCharGroups?: Record<string, string[]>
}

export interface RawHandbookPowerRecord {
  powerId?: unknown
  powerName?: unknown
  powerCode?: unknown
}

export type RawHandbookTeamTable = Record<string, RawHandbookPowerRecord>

export interface OperatorNormalizationMetadata {
  cnPatch?: RawCharacterPatchTable
  enPatch?: RawCharacterPatchTable
  cnCharMeta?: RawCharacterMetaTable
  enCharMeta?: RawCharacterMetaTable
  /** Backward-compatible test/input alias. */
  charMeta?: RawCharacterMetaTable
  cnGacha?: RawGachaTable
  /** Backward-compatible single-catalog input used by tests and callers. */
  enHandbookTeams?: RawHandbookTeamTable
  /** Preferred pre-resolved faction label map when both CN and EN catalogs are available. */
  factionLabels?: Record<string, string>
  releaseDates?: Record<string, OperatorReleaseDates>
  releaseCategories?: Record<string, OperatorReleaseCategory | null>
}

const professionMap: Record<string, OperatorClass> = {
  PIONEER: 'Vanguard',
  WARRIOR: 'Guard',
  TANK: 'Defender',
  SNIPER: 'Sniper',
  CASTER: 'Caster',
  MEDIC: 'Medic',
  SUPPORT: 'Supporter',
  SPECIAL: 'Specialist',
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function rawPowerReference(value: unknown): RawPowerReference | null {
  return value && typeof value === 'object' ? (value as RawPowerReference) : null
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))]
}

export function normalizeRarity(value: unknown): OperatorRarity | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0 && value <= 5) return (value + 1) as OperatorRarity
    if (value === 6) return 6
    return null
  }

  if (typeof value !== 'string') return null

  const tierMatch = /^TIER_([1-6])$/i.exec(value)
  if (tierMatch) return Number(tierMatch[1]) as OperatorRarity

  if (/^[0-5]$/.test(value)) return (Number(value) + 1) as OperatorRarity
  if (value === '6') return 6

  return null
}

export function normalizeProfession(value: unknown): OperatorClass | null {
  if (typeof value !== 'string') return null
  return professionMap[value.toUpperCase()] ?? null
}

export function factionLabelsFromHandbook(
  handbook: RawHandbookTeamTable | undefined,
  preferCode = false,
): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [key, record] of Object.entries(handbook ?? {})) {
    const id = cleanString(record?.powerId) ?? cleanString(key)
    const powerName = cleanString(record?.powerName)
    const powerCode = cleanString(record?.powerCode)
    const name = preferCode ? (powerCode ?? powerName) : (powerName ?? powerCode)
    if (!id || !name || id === 'none') continue
    labels[id] = name
  }
  return labels
}

export function factionLabelsFromHandbooks(
  cn: RawHandbookTeamTable | undefined,
  en: RawHandbookTeamTable | undefined,
): Record<string, string> {
  return {
    // CN can contain factions that are not yet present in Global. Prefer its
    // stable powerCode as the English fallback for those ahead-of-EN entries.
    ...factionLabelsFromHandbook(cn, true),
    // EN powerName is the preferred localized label whenever available.
    ...factionLabelsFromHandbook(en),
  }
}

export function normalizeFaction(record: RawCharacterRecord | undefined): OperatorFaction {
  if (!record) return { main: null, affiliations: [] }

  const mainPower = rawPowerReference(record.mainPower)
  const nationId = cleanString(record.nationId)
  const groupId = cleanString(record.groupId)
  const teamId = cleanString(record.teamId)
  const mainNationId = cleanString(mainPower?.nationId)
  const mainGroupId = cleanString(mainPower?.groupId)
  const mainTeamId = cleanString(mainPower?.teamId)

  // mainPower is authoritative. Prefer the most specific populated level.
  const main =
    mainTeamId ?? mainGroupId ?? mainNationId ?? teamId ?? groupId ?? nationId ?? null
  const affiliations = uniqueStrings([
    nationId,
    groupId,
    teamId,
    mainNationId,
    mainGroupId,
    mainTeamId,
    main,
  ])

  return { main, affiliations }
}

function isPlayableOperator(id: string, record: RawCharacterRecord | undefined): boolean {
  if (!record || !/^char_[a-z0-9_]+$/i.test(id)) return false
  if (record.isNotObtainable !== false) return false
  if (!normalizeRarity(record.rarity) || !normalizeProfession(record.profession)) return false
  return Boolean(cleanString(record.name) || cleanString(record.appellation))
}

function displayName(
  id: string,
  cnRecord: RawCharacterRecord | undefined,
  enRecord: RawCharacterRecord | undefined,
): string | null {
  const formNames: Record<string, string> = {
    char_002_amiya: 'Amiya (Caster)',
    char_1001_amiya2: 'Amiya (Guard)',
    char_1037_amiya3: 'Amiya (Medic)',
  }
  if (formNames[id]) return formNames[id]

  return (
    cleanString(enRecord?.name) ??
    cleanString(enRecord?.appellation) ??
    cleanString(cnRecord?.appellation) ??
    cleanString(cnRecord?.name)
  )
}

function alterGroups(...metas: Array<RawCharacterMetaTable | undefined>): Map<string, string> {
  const result = new Map<string, string>()
  for (const meta of metas) {
    for (const [baseId, members] of Object.entries(meta?.spCharGroups ?? {})) {
      if (!Array.isArray(members) || members.length < 2) continue
      const group = `alter:${baseId}`
      for (const member of members) result.set(member, group)
    }
  }
  return result
}

export function createReleaseDateMap(
  infoSource: string,
  candidateSource: string,
  eventSource: string,
): Record<string, OperatorReleaseDates> {
  return buildReleaseDateMap(infoSource, candidateSource, eventSource)
}

export function createReleaseCategoryMap(
  infoSource: string,
): Record<string, OperatorReleaseCategory | null> {
  return buildReleaseCategoryMap(infoSource)
}

export function normalizeCharacterTables(
  cn: RawCharacterTable,
  en: RawCharacterTable,
  sources: OperatorDatasetSources,
  generatedAt = new Date().toISOString(),
  metadata: OperatorNormalizationMetadata = {},
): OperatorDataset {
  const cnPatch = metadata.cnPatch?.patchChars ?? {}
  const enPatch = metadata.enPatch?.patchChars ?? {}
  const ids = new Set([
    ...Object.keys(cn),
    ...Object.keys(en),
    ...Object.keys(cnPatch),
    ...Object.keys(enPatch),
  ])
  const familyById = alterGroups(metadata.enCharMeta, metadata.charMeta, metadata.cnCharMeta)
  const limitedIds = limitedOperatorIds(metadata.cnGacha)
  const factionLabels = metadata.factionLabels ?? factionLabelsFromHandbook(metadata.enHandbookTeams)
  const operators: Operator[] = []

  for (const id of ids) {
    if (isModeOnlyOperator(id)) continue

    const cnRecord = cn[id] ?? cnPatch[id]
    const enRecord = en[id] ?? enPatch[id]
    const cnPlayable = isPlayableOperator(id, cnRecord)
    const globalPlayable = isPlayableOperator(id, enRecord)

    if (!cnPlayable && !globalPlayable) continue

    // CN is the freshest game-data source for taxonomy/faction metadata; EN is
    // still preferred by displayName for localized operator names.
    const reference = (cnPlayable ? cnRecord : enRecord) as RawCharacterRecord
    const rarity = normalizeRarity(reference.rarity)
    const operatorClass = normalizeProfession(reference.profession)
    const name = displayName(id, cnRecord, enRecord)
    const subclassId = cleanString(reference.subProfessionId) ?? ''

    if (!rarity || !operatorClass || !name) continue

    const releaseDates = metadata.releaseDates?.[id] ?? { cn: null, global: null }
    const collaboration = COLLABORATION_BY_OPERATOR_ID[id] ?? null
    const acquisition = classifyAcquisition({
      id,
      obtainApproach: cnRecord?.itemObtainApproach ?? enRecord?.itemObtainApproach,
      releaseCategory: metadata.releaseCategories?.[id] ?? null,
      cnReleaseDate: releaseDates.cn,
      collaboration,
      limitedIds,
    })

    operators.push({
      id,
      name,
      rarity,
      class: operatorClass,
      subclass: {
        id: subclassId,
        name: SUBCLASS_LABELS[subclassId] ?? subclassId,
      },
      faction: normalizeFaction(reference),
      availableOn: {
        cn: cnPlayable,
        global: globalPlayable,
      },
      release: {
        cn: {
          date: cnPlayable ? releaseDates.cn : null,
          yearGroup: cnPlayable ? releaseYearGroup(releaseDates.cn, 'cn') : null,
        },
        global: {
          date: globalPlayable ? releaseDates.global : null,
          yearGroup: globalPlayable ? releaseYearGroup(releaseDates.global, 'global') : null,
        },
      },
      acquisition,
      collaboration,
      alterGroup: familyById.get(id) ?? null,
      mandatoryExclusivityGroup:
        id.startsWith('char_002_amiya') ||
        id === 'char_1001_amiya2' ||
        id === 'char_1037_amiya3'
          ? 'amiya-forms'
          : null,
      imageFile: `operators/${id}.png`,
    })
  }

  operators.sort((left, right) => {
    if (left.rarity !== right.rarity) return right.rarity - left.rarity
    return left.name.localeCompare(right.name)
  })

  return {
    schemaVersion: OPERATOR_DATASET_SCHEMA_VERSION,
    generatedAt,
    sources,
    factionLabels,
    operators,
  }
}

export interface DatasetValidationOptions {
  minimumOperators?: number
  maximumOperators?: number
  requireSourceCommits?: boolean
}

export interface DatasetValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validReleaseDate(value: string | null): boolean {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function validateOperatorDataset(
  dataset: unknown,
  options: DatasetValidationOptions = {},
): DatasetValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const minimumOperators = options.minimumOperators ?? 300
  const maximumOperators = options.maximumOperators ?? 750

  if (!dataset || typeof dataset !== 'object') {
    return { valid: false, errors: ['Dataset must be an object.'], warnings }
  }

  const candidate = dataset as Partial<OperatorDataset>

  if (candidate.schemaVersion !== OPERATOR_DATASET_SCHEMA_VERSION) {
    errors.push('Unsupported operator dataset schema version.')
  }
  if (!candidate.factionLabels || typeof candidate.factionLabels !== 'object') {
    errors.push('Dataset has no faction label map.')
  }
  if (!Array.isArray(candidate.operators)) {
    errors.push('Dataset operators must be an array.')
    return { valid: false, errors, warnings }
  }

  if (candidate.operators.length < minimumOperators) {
    errors.push(
      `Dataset contains only ${candidate.operators.length} operators; expected at least ${minimumOperators}.`,
    )
  }
  if (candidate.operators.length > maximumOperators) {
    errors.push(
      `Dataset contains ${candidate.operators.length} operators; expected no more than ${maximumOperators}.`,
    )
  }

  const factionLabels = candidate.factionLabels ?? {}
  for (const [id, label] of Object.entries(factionLabels)) {
    if (!id.trim() || typeof label !== 'string' || !label.trim()) {
      errors.push(`Dataset has an invalid faction label entry for ${String(id)}.`)
    }
  }

  const seen = new Set<string>()
  const knownClasses = new Set<string>(operatorClasses)
  const knownLimitedGroups = new Set<string>(limitedAcquisitionGroups)
  const knownWelfareGroups = new Set<string>(welfareAcquisitionGroups)

  for (const operator of candidate.operators as Operator[]) {
    if (!operator || typeof operator !== 'object') {
      errors.push('Dataset contains a non-object operator entry.')
      continue
    }

    if (!/^char_[a-z0-9_]+$/i.test(operator.id)) {
      errors.push(`Invalid operator id: ${String(operator.id)}`)
    } else if (seen.has(operator.id)) {
      errors.push(`Duplicate operator id: ${operator.id}`)
    } else {
      seen.add(operator.id)
    }

    if (isModeOnlyOperator(operator.id)) {
      errors.push(`Mode-only operator ${operator.id} must not be present in the dataset.`)
    }

    if (typeof operator.name !== 'string' || operator.name.trim().length === 0) {
      errors.push(`Operator ${operator.id} has no display name.`)
    }

    if (!Number.isInteger(operator.rarity) || operator.rarity < 1 || operator.rarity > 6) {
      errors.push(`Operator ${operator.id} has invalid rarity.`)
    }

    if (!knownClasses.has(operator.class)) {
      errors.push(`Operator ${operator.id} has invalid class: ${String(operator.class)}`)
    }

    const subclassId = operator.subclass?.id
    const expectedSubclassName = subclassId ? SUBCLASS_LABELS[subclassId] : undefined
    if (!subclassId || !expectedSubclassName) {
      errors.push(`Operator ${operator.id} has unknown subclass: ${String(subclassId)}.`)
    } else if (operator.subclass.name !== expectedSubclassName) {
      errors.push(`Operator ${operator.id} has an invalid subclass display name.`)
    }

    const faction = operator.faction
    if (!faction || !Array.isArray(faction.affiliations)) {
      errors.push(`Operator ${operator.id} has invalid faction metadata.`)
    } else {
      const uniqueAffiliations = new Set(faction.affiliations)
      if (uniqueAffiliations.size !== faction.affiliations.length) {
        errors.push(`Operator ${operator.id} has duplicate faction affiliations.`)
      }
      if (faction.main && !uniqueAffiliations.has(faction.main)) {
        errors.push(`Operator ${operator.id} main faction is missing from affiliations.`)
      }
      for (const factionId of faction.affiliations) {
        if (!factionLabels[factionId]) {
          errors.push(`Operator ${operator.id} has unknown faction: ${factionId}.`)
        }
      }
    }

    if (!operator.availableOn?.cn && !operator.availableOn?.global) {
      errors.push(`Operator ${operator.id} is unavailable on both CN and Global.`)
    }

    if (operator.availableOn?.global && !operator.availableOn?.cn) {
      warnings.push(`Operator ${operator.id} is Global-visible but absent from the CN playable set.`)
    }

    for (const server of ['cn', 'global'] as const) {
      const release = operator.release?.[server]
      if (!release || !validReleaseDate(release.date)) {
        errors.push(`Operator ${operator.id} has an invalid ${server.toUpperCase()} release date.`)
      } else if (
        release.yearGroup !== null &&
        (!Number.isInteger(release.yearGroup) || release.yearGroup < 0)
      ) {
        errors.push(`Operator ${operator.id} has an invalid ${server.toUpperCase()} release year group.`)
      } else if (operator.availableOn[server] && (!release.date || release.yearGroup === null)) {
        errors.push(`Operator ${operator.id} is missing its ${server.toUpperCase()} release metadata.`)
      }
    }

    const acquisition = operator.acquisition
    if (!acquisition || !['limited', 'standard', 'welfare'].includes(acquisition.family)) {
      errors.push(`Operator ${operator.id} has invalid acquisition metadata.`)
    } else if (
      acquisition.family === 'limited' &&
      !knownLimitedGroups.has(String(acquisition.group))
    ) {
      errors.push(`Operator ${operator.id} has an invalid Limited acquisition group.`)
    } else if (acquisition.family === 'standard' && acquisition.group !== null) {
      errors.push(`Operator ${operator.id} Standard acquisition must not have a subgroup.`)
    } else if (
      acquisition.family === 'welfare' &&
      !knownWelfareGroups.has(String(acquisition.group))
    ) {
      errors.push(`Operator ${operator.id} has an invalid Welfare acquisition group.`)
    }

    if (
      operator.collaboration !== null &&
      (typeof operator.collaboration !== 'string' || operator.collaboration.length === 0)
    ) {
      errors.push(`Operator ${operator.id} has invalid collaboration metadata.`)
    }

    if (operator.imageFile !== `operators/${operator.id}.png`) {
      errors.push(`Operator ${operator.id} has an unexpected image path.`)
    }
  }

  for (const [server, cutoff] of Object.entries(KERNEL_CUTOFF_BY_SERVER)) {
    if (!validReleaseDate(cutoff)) {
      errors.push(`Kernel cutoff for ${server} is not a valid release date.`)
    }
  }

  if (!candidate.generatedAt || Number.isNaN(Date.parse(candidate.generatedAt))) {
    errors.push('Dataset has no valid generatedAt timestamp.')
  }

  if (options.requireSourceCommits) {
    const sources = candidate.sources
    if (
      !sources?.gamedataCnCommit ||
      !sources.gamedataEnCommit ||
      !sources.resourcesCommit ||
      !sources.releaseMetadataCommit
    ) {
      errors.push('Dataset is missing one or more upstream source commit SHAs.')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export type { RawGachaTable } from './acquisitionMetadata.ts'
