import {
  gameLocales,
  type GameLocale,
  type GameStringCatalog,
  type OperatorDataset,
} from './operator.ts'

export const RACE_UNAVAILABLE_ID = 'race:unavailable' as const

export interface RawHandbookStory {
  storyText?: unknown
}

export interface RawHandbookStorySection {
  stories?: RawHandbookStory[]
}

export interface RawHandbookInfoRecord {
  storyTextAudio?: RawHandbookStorySection[]
}

export interface RawHandbookInfoTable {
  handbookDict?: Record<string, RawHandbookInfoRecord>
}

export type LocalizedHandbookInfoTables = Partial<Record<GameLocale, RawHandbookInfoTable>>

const RACE_LINE_PATTERNS: Readonly<Record<GameLocale, RegExp>> = {
  en: /^\[Race\]\s*(.+?)\s*$/im,
  jp: /^【種族】\s*(.+?)\s*$/m,
  kr: /^\[종족\]\s*(.+?)\s*$/m,
  tw: /^【種族】\s*(.+?)\s*$/m,
  cn: /^【种族】\s*(.+?)\s*$/m,
}

function cleanSourceValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

function normalizeKnownSourceQuirk(
  operatorId: string,
  locale: GameLocale,
  value: string,
): string {
  // EN handbook currently publishes Ch'en as "Lung." while the same source value
  // has historically been "Lung". Keep the stable race label/identity unchanged
  // without applying punctuation-stripping to unrelated source values.
  if (operatorId === 'char_010_chen' && locale === 'en' && value === 'Lung.') return 'Lung'
  return value
}

/**
 * Extracts the source-provided Race value from an operator's Basic Info text.
 * The field label is locale-specific, but the returned value is never translated
 * or interpreted by the randomizer.
 */
export function raceValueFromHandbookRecord(
  record: RawHandbookInfoRecord | undefined,
  locale: GameLocale,
): string | null {
  const pattern = RACE_LINE_PATTERNS[locale]
  for (const section of record?.storyTextAudio ?? []) {
    for (const story of section.stories ?? []) {
      if (typeof story.storyText !== 'string') continue
      const match = pattern.exec(story.storyText)
      const value = cleanSourceValue(match?.[1])
      if (value) return value
    }
  }
  return null
}

export function raceValuesFromHandbook(
  table: RawHandbookInfoTable | undefined,
  locale: GameLocale,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [operatorId, record] of Object.entries(table?.handbookDict ?? {})) {
    const value = raceValueFromHandbookRecord(record, locale)
    if (value) values[operatorId] = normalizeKnownSourceQuirk(operatorId, locale, value)
  }
  return values
}

/**
 * Stable filter identity is derived from the canonical CN source value, not the
 * currently selected display language. EN is used only when a CN handbook race
 * value is unavailable for that operator.
 */
export function raceIdFromSourceValue(value: string, source: 'cn' | 'en' = 'cn'): string {
  const normalized = cleanSourceValue(value)
  if (!normalized) return RACE_UNAVAILABLE_ID
  return `race:${source}:${encodeURIComponent(normalized.toLocaleLowerCase('en-US'))}`
}

function preferredLabel(values: readonly string[], fallback: string): string {
  if (values.length === 0) return fallback
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const sorted = [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || leftValue.localeCompare(rightValue),
  )
  return sorted[0]?.[0] ?? fallback
}

function catalogWithRaceLabels(
  catalog: GameStringCatalog | undefined,
  raceLabels: Record<string, string>,
): GameStringCatalog {
  return {
    operatorNames: { ...(catalog?.operatorNames ?? {}) },
    classLabels: { ...(catalog?.classLabels ?? {}) } as GameStringCatalog['classLabels'],
    subclassLabels: { ...(catalog?.subclassLabels ?? {}) },
    factionLabels: { ...(catalog?.factionLabels ?? {}) },
    raceLabels,
  }
}

/**
 * Adds source-driven stable race IDs and localized race labels to a normalized
 * operator dataset. This is intentionally additive so schema-v6 datasets from
 * before M6 remain readable and simply resolve to the Unavailable bucket.
 */
export function applyRaceMetadata(
  dataset: OperatorDataset,
  handbooks: LocalizedHandbookInfoTables,
): OperatorDataset {
  const valuesByLocale = Object.fromEntries(
    gameLocales.map((locale) => [locale, raceValuesFromHandbook(handbooks[locale], locale)]),
  ) as Record<GameLocale, Record<string, string>>

  const raceIdByOperator = new Map<string, string>()
  for (const operator of dataset.operators) {
    const cnValue = valuesByLocale.cn[operator.id]
    const enValue = valuesByLocale.en[operator.id]
    raceIdByOperator.set(
      operator.id,
      cnValue
        ? raceIdFromSourceValue(cnValue, 'cn')
        : enValue
          ? raceIdFromSourceValue(enValue, 'en')
          : RACE_UNAVAILABLE_ID,
    )
  }

  const localizedRaceLabels = Object.fromEntries(
    gameLocales.map((locale) => {
      const candidates = new Map<string, string[]>()
      for (const operator of dataset.operators) {
        const raceId = raceIdByOperator.get(operator.id) ?? RACE_UNAVAILABLE_ID
        const value = valuesByLocale[locale][operator.id]
        if (!value) continue
        const current = candidates.get(raceId) ?? []
        current.push(value)
        candidates.set(raceId, current)
      }

      const labels: Record<string, string> = { [RACE_UNAVAILABLE_ID]: 'Unavailable' }
      for (const [raceId, values] of candidates) {
        labels[raceId] = preferredLabel(values, raceId)
      }
      return [locale, labels]
    }),
  ) as Record<GameLocale, Record<string, string>>

  const canonicalRaceLabels: Record<string, string> = {
    [RACE_UNAVAILABLE_ID]: 'Unavailable',
  }
  for (const operator of dataset.operators) {
    const raceId = raceIdByOperator.get(operator.id) ?? RACE_UNAVAILABLE_ID
    canonicalRaceLabels[raceId] ??=
      valuesByLocale.en[operator.id] ?? valuesByLocale.cn[operator.id] ?? 'Unavailable'
  }

  const localizations = Object.fromEntries(
    gameLocales.map((locale) => [
      locale,
      catalogWithRaceLabels(dataset.localizations?.[locale], localizedRaceLabels[locale]),
    ]),
  ) as OperatorDataset['localizations']

  return {
    ...dataset,
    raceLabels: canonicalRaceLabels,
    localizations,
    operators: dataset.operators.map((operator) => ({
      ...operator,
      raceIds: [raceIdByOperator.get(operator.id) ?? RACE_UNAVAILABLE_ID],
    })),
  }
}

export function operatorRaceIds(operator: { raceIds?: readonly string[] }): readonly string[] {
  return operator.raceIds && operator.raceIds.length > 0
    ? operator.raceIds
    : [RACE_UNAVAILABLE_ID]
}
