import {
  gameLocales,
  type GameLocale,
  type OperatorDefaultArt,
  type OperatorDataset,
  type OperatorSkin,
} from './operator.ts'

export const OPERATOR_SKIN_METADATA_VERSION = 4 as const

export interface RawSkinRecord {
  skinId?: unknown
  charId?: unknown
  tmplId?: unknown
  portraitId?: unknown
  avatarId?: unknown
  displaySkin?: {
    skinName?: unknown
    skinGroupName?: unknown
    getTime?: unknown
    sortId?: unknown
  } | null
}

export interface RawSkinTable {
  charSkins?: Record<string, RawSkinRecord>
  buildinEvolveMap?: Record<string, Record<string, string>>
  buildinPatchMap?: Record<string, Record<string, string>>
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function localizedSkinName(record: RawSkinRecord | undefined): string | null {
  const skinName = record?.displaySkin?.skinName
  if (typeof skinName === 'string' && skinName.trim()) return skinName.trim()
  const groupName = record?.displaySkin?.skinGroupName
  if (typeof groupName === 'string' && groupName.trim()) return groupName.trim()
  return null
}

function localizedSkinBrand(record: RawSkinRecord | undefined): string | null {
  const groupName = record?.displaySkin?.skinGroupName
  if (typeof groupName === 'string' && groupName.trim()) return groupName.trim()
  return null
}

function skinReleaseTime(record: RawSkinRecord | undefined): number | null {
  const value = record?.displaySkin?.getTime
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function compareSkinsByRelease(left: OperatorSkin, right: OperatorSkin): number {
  const leftTime = left.releaseTime
  const rightTime = right.releaseTime
  if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
    return leftTime - rightTime
  }
  if (leftTime !== undefined && rightTime === undefined) return -1
  if (leftTime === undefined && rightTime !== undefined) return 1
  return left.id.localeCompare(right.id)
}

function skinOwnerId(skinId: string, raw: RawSkinRecord): string | null {
  const tmplId = cleanString(raw.tmplId)
  if (tmplId) return tmplId

  const prefix = skinId.split('@', 1)[0]
  if (/^char_[a-z0-9_]+$/i.test(prefix)) return prefix
  return cleanString(raw.charId)
}

function defaultArtLabel(phase: number | undefined, total: number): string {
  if (total <= 1) return 'Default'
  if (total === 2) return phase === 2 ? 'E2' : 'E1'
  if (phase === 0) return 'E0'
  if (phase === 1) return 'E1'
  if (phase === 2) return 'E2'
  return phase === undefined ? 'Default' : `E${phase}`
}

function defaultArtFromSkin(
  skinId: string,
  record: RawSkinRecord | undefined,
  phase: number | undefined,
  total: number,
): OperatorDefaultArt | null {
  const avatarId = cleanString(record?.avatarId)
  const portraitId = cleanString(record?.portraitId)
  if (!avatarId || !portraitId) return null
  return {
    id: skinId,
    avatarId,
    portraitId,
    ...(phase !== undefined ? { phase } : {}),
    label: defaultArtLabel(phase, total),
  }
}

function defaultArtsForOperator(
  operatorId: string,
  table: RawSkinTable,
): OperatorDefaultArt[] {
  const skins = table.charSkins ?? {}
  const evolve = table.buildinEvolveMap?.[operatorId]
  if (evolve) {
    const entries = Object.entries(evolve)
      .map(([phase, skinId]) => ({ phase: Number(phase), skinId }))
      .filter(({ phase, skinId }) => Number.isInteger(phase) && typeof skinId === 'string')
      .sort((left, right) => left.phase - right.phase)
    const arts = entries
      .map(({ phase, skinId }) => defaultArtFromSkin(skinId, skins[skinId], phase, entries.length))
      .filter((art): art is OperatorDefaultArt => art !== null)
    if (arts.length > 0) return arts
  }

  for (const patchMap of Object.values(table.buildinPatchMap ?? {})) {
    const skinId = patchMap[operatorId]
    if (!skinId) continue
    const art = defaultArtFromSkin(skinId, skins[skinId], undefined, 1)
    if (art) return [art]
  }

  const fallbackIds = Object.keys(skins)
    .filter((skinId) => skinId.startsWith(`${operatorId}#`) && !skinId.includes('@'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  return fallbackIds
    .map((skinId) => defaultArtFromSkin(skinId, skins[skinId], undefined, fallbackIds.length))
    .filter((art): art is OperatorDefaultArt => art !== null)
}

export function applySkinMetadata(
  dataset: OperatorDataset,
  tables: Partial<Record<GameLocale, RawSkinTable>>,
): OperatorDataset {
  const cnTable = tables.cn ?? {}
  const cnSkins = cnTable.charSkins ?? {}
  const byOperator = new Map<string, OperatorSkin[]>()

  for (const [key, raw] of Object.entries(cnSkins)) {
    const skinId = cleanString(raw.skinId) ?? key
    if (!skinId.includes('@')) continue

    const ownerId = skinOwnerId(skinId, raw)
    const portraitId = cleanString(raw.portraitId)
    const avatarId = cleanString(raw.avatarId)
    if (!ownerId || !portraitId) continue

    const names: Partial<Record<GameLocale, string>> = {}
    const brands: Partial<Record<GameLocale, string>> = {}
    for (const locale of gameLocales) {
      const localizedRecord = tables[locale]?.charSkins?.[skinId]
      const localized = localizedSkinName(localizedRecord)
      const brand = localizedSkinBrand(localizedRecord)
      if (localized) names[locale] = localized
      if (brand) brands[locale] = brand
    }

    if (Object.keys(names).length === 0) {
      const fallback = localizedSkinName(raw)
      if (fallback) names.cn = fallback
    }
    if (Object.keys(brands).length === 0) {
      const fallbackBrand = localizedSkinBrand(raw)
      if (fallbackBrand) brands.cn = fallbackBrand
    }

    const releaseTime = skinReleaseTime(raw)
    const list = byOperator.get(ownerId) ?? []
    list.push({
      id: skinId,
      portraitId,
      ...(avatarId ? { avatarId } : {}),
      ...(releaseTime !== null ? { releaseTime } : {}),
      names,
      ...(Object.keys(brands).length > 0 ? { brands } : {}),
    })
    byOperator.set(ownerId, list)
  }

  return {
    ...dataset,
    skinMetadataVersion: OPERATOR_SKIN_METADATA_VERSION,
    operators: dataset.operators.map((operator) => ({
      ...operator,
      defaultArts: defaultArtsForOperator(operator.id, cnTable),
      skins: [...(byOperator.get(operator.id) ?? [])].sort(compareSkinsByRelease),
    })),
  }
}

export function skinDisplayName(skin: OperatorSkin, locale: GameLocale): string {
  return skin.names[locale] ?? skin.names.en ?? skin.names.cn ?? skin.id
}

export function skinBrandName(skin: OperatorSkin, locale: GameLocale): string | null {
  return skin.brands?.[locale] ?? skin.brands?.en ?? skin.brands?.cn ?? null
}

export function operatorDatasetNeedsSkinMetadataRefresh(dataset: OperatorDataset): boolean {
  return dataset.skinMetadataVersion !== OPERATOR_SKIN_METADATA_VERSION
}
