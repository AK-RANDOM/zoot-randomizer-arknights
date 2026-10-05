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
  kr: /^\[종족\]\s*(.+?)\s*$/im,
  tw: /^【種族】\s*(.+?)\s*$/m,
  cn: /^【种族】\s*(.+?)\s*$/m,
}

function normalizedRaceLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function parseRaceLabelFromHandbook(
  record: RawHandbookInfoRecord | undefined,
  locale: GameLocale,
): string | null {
  const pattern = RACE_LINE_PATTERNS[locale]
  for (const section of record?.storyTextAudio ?? []) {
    for (const story of section.stories ?? []) {
      if (typeof story.storyText !== 'string') continue
      const match = pattern.exec(story.storyText)
      if (!match?.[1]) continue
      const value = normalizedRaceLabel(match[1])
      if (value) return value
    }
  }
  return null
}

function raceIdentitySource(
  labels: Partial<Record<GameLocale, string>>,
): { locale: GameLocale; label: string } | null {
  for (const locale of ['cn', 'en', 'jp', 'kr', 'tw'] as const) {
    const label = labels[locale]
    if (label) return { locale, label }
  }
  return null
}

/** Stable source-derived key. The handbook currently exposes localized free-form Race text, not a native ID. */
export function raceIdFromLabels(labels: Partial<Record<GameLocale, string>>): string {
  const source = raceIdentitySource(labels)
  if (!source) return RACE_UNAVAILABLE_ID
  return `race:${source.locale}:${encodeURIComponent(source.label)}`
}

export function localizedRaceLabelsForOperator(
  operatorId: string,
  handbooks: LocalizedHandbookInfoTables,
): Partial<Record<GameLocale, string>> {
  const labels: Partial<Record<GameLocale, string>> = {}
  for (const locale of gameLocales) {
    const label = parseRaceLabelFromHandbook(handbooks[locale]?.handbookDict?.[operatorId], locale)
    if (label) labels[locale] = label
  }
  return labels
}

export function operatorRaceIds(operator: { races?: readonly { id: string }[] }): string[] {
  return operator.races?.map(({ id }) => id) ?? [RACE_UNAVAILABLE_ID]
}

function localeFallbackOrder(locale: GameLocale): readonly GameLocale[] {
  switch (locale) {
    case 'tw':
      return ['tw', 'en', 'cn', 'jp', 'kr']
    case 'cn':
      return ['cn', 'en', 'jp', 'kr', 'tw']
    default:
      return [locale, 'en', 'cn', ...gameLocales.filter((candidate) => candidate !== locale && candidate !== 'en' && candidate !== 'cn')]
  }
}

function displayLabel(
  labels: Partial<Record<GameLocale, string>>,
  locale: GameLocale,
  fallback = 'Unavailable',
): string {
  for (const candidate of localeFallbackOrder(locale)) {
    const value = labels[candidate]
    if (value) return value
  }
  return fallback
}

export function applyRaceMetadata(
  dataset: OperatorDataset,
  handbooks: LocalizedHandbookInfoTables,
): OperatorDataset {
  const raceLabelsByLocale: Partial<Record<GameLocale, GameStringCatalog>> = Object.fromEntries(
    gameLocales.map((locale) => [locale, {}]),
  )

  const operators = dataset.operators.map((operator) => {
    const labels = localizedRaceLabelsForOperator(operator.id, handbooks)
    const raceId = raceIdFromLabels(labels)
    for (const locale of gameLocales) {
      raceLabelsByLocale[locale]![raceId] =
        raceId === RACE_UNAVAILABLE_ID
          ? 'Unavailable'
          : displayLabel(labels, locale, raceId)
    }
    return { ...operator, races: [{ id: raceId }] }
  })

  const localizedStrings = { ...(dataset.localizedStrings ?? {}) }
  for (const locale of gameLocales) {
    localizedStrings[locale] = {
      ...(localizedStrings[locale] ?? {}),
      races: raceLabelsByLocale[locale],
    }
  }

  return {
    ...dataset,
    operators,
    localizedStrings,
    raceLabels: raceLabelsByLocale.en,
  }
}
