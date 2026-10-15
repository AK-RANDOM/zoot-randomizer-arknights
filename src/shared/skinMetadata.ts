import { gameLocales, type GameLocale, type OperatorDataset, type OperatorSkin } from './operator.ts'

export const OPERATOR_SKIN_METADATA_VERSION = 2 as const

export interface RawSkinRecord {
  skinId?: unknown
  charId?: unknown
  portraitId?: unknown
  avatarId?: unknown
  displaySkin?: {
    skinName?: unknown
    skinGroupName?: unknown
  } | null
}

export interface RawSkinTable {
  charSkins?: Record<string, RawSkinRecord>
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

export function applySkinMetadata(
  dataset: OperatorDataset,
  tables: Partial<Record<GameLocale, RawSkinTable>>,
): OperatorDataset {
  const cnSkins = tables.cn?.charSkins ?? {}
  const byOperator = new Map<string, OperatorSkin[]>()

  for (const [key, raw] of Object.entries(cnSkins)) {
    const skinId = typeof raw.skinId === 'string' ? raw.skinId : key
    const charId = typeof raw.charId === 'string' ? raw.charId : null
    const portraitId = typeof raw.portraitId === 'string' ? raw.portraitId : null
    const avatarId = typeof raw.avatarId === 'string' && raw.avatarId.trim() ? raw.avatarId.trim() : null
    if (!charId || !portraitId || !skinId.includes('@')) continue

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

    const list = byOperator.get(charId) ?? []
    list.push({
      id: skinId,
      portraitId,
      ...(avatarId ? { avatarId } : {}),
      names,
      ...(Object.keys(brands).length > 0 ? { brands } : {}),
    })
    byOperator.set(charId, list)
  }

  return {
    ...dataset,
    skinMetadataVersion: OPERATOR_SKIN_METADATA_VERSION,
    operators: dataset.operators.map((operator) => ({
      ...operator,
      skins: [...(byOperator.get(operator.id) ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
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
