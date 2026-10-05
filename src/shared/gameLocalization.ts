import {
  gameLocales,
  operatorClasses,
  type GameLocale,
  type GameStringCatalog,
  type OperatorClass,
  type OperatorDataset,
} from './operator'
import { RACE_UNAVAILABLE_ID, operatorRaceIds } from './raceMetadata'

/**
 * This module is the boundary for Arknights-owned display strings.
 *
 * Catalog values come from official game data (operator, class, subclass,
 * faction and race names). Randomizer-owned UI copy does not belong here and
 * will use the app-localization layer separately. Game entities keep their
 * stable IDs; localization only replaces display values and must not change
 * filtering, persistence, solver input, or randomizer ordering.
 */
export const GAME_LOCALE_LABELS: Readonly<Record<GameLocale, string>> = {
  en: 'English',
  jp: '日本語',
  kr: '한국어',
  tw: '繁體中文',
  cn: '简体中文',
}

export const GAME_LOCALE_FALLBACKS: Readonly<Record<GameLocale, readonly GameLocale[]>> = {
  en: ['en', 'cn'],
  jp: ['jp', 'en', 'cn'],
  kr: ['kr', 'en', 'cn'],
  tw: ['tw', 'en', 'cn'],
  cn: ['cn', 'en'],
}

export function isGameLocale(value: unknown): value is GameLocale {
  return typeof value === 'string' && (gameLocales as readonly string[]).includes(value)
}

const EMPTY_CATALOG: GameStringCatalog = {
  operatorNames: {},
  classLabels: {} as Record<OperatorClass, string>,
  subclassLabels: {},
  factionLabels: {},
  raceLabels: {},
}

function catalogFor(dataset: OperatorDataset, locale: GameLocale): GameStringCatalog {
  return dataset.localizations?.[locale] ?? EMPTY_CATALOG
}

function resolveFromCatalogs(
  dataset: OperatorDataset,
  locale: GameLocale,
  select: (catalog: GameStringCatalog) => string | undefined,
): string | null {
  for (const candidate of GAME_LOCALE_FALLBACKS[locale]) {
    const value = select(catalogFor(dataset, candidate))?.trim()
    if (value) return value
  }
  return null
}

export function localizedClassLabel(
  dataset: OperatorDataset,
  locale: GameLocale,
  operatorClass: OperatorClass,
): string {
  return (
    resolveFromCatalogs(dataset, locale, (catalog) => catalog.classLabels[operatorClass]) ??
    operatorClass
  )
}

export function localizeOperatorDataset(
  dataset: OperatorDataset,
  locale: GameLocale,
): OperatorDataset {
  const classLabels = Object.fromEntries(
    operatorClasses.map((operatorClass) => [
      operatorClass,
      localizedClassLabel(dataset, locale, operatorClass),
    ]),
  ) as Record<OperatorClass, string>

  const factionIds = new Set<string>()
  for (const operator of dataset.operators) {
    for (const factionId of operator.faction.affiliations) factionIds.add(factionId)
  }
  for (const catalog of Object.values(dataset.localizations ?? {})) {
    for (const factionId of Object.keys(catalog.factionLabels)) factionIds.add(factionId)
  }

  const factionLabels: Record<string, string> = {}
  for (const factionId of factionIds) {
    factionLabels[factionId] =
      resolveFromCatalogs(dataset, locale, (catalog) => catalog.factionLabels[factionId]) ??
      dataset.factionLabels[factionId] ??
      factionId
  }

  const raceIds = new Set<string>()
  for (const operator of dataset.operators) {
    for (const raceId of operatorRaceIds(operator)) raceIds.add(raceId)
  }
  for (const catalog of Object.values(dataset.localizations ?? {})) {
    for (const raceId of Object.keys(catalog.raceLabels ?? {})) raceIds.add(raceId)
  }

  const raceLabels: Record<string, string> = {}
  for (const raceId of raceIds) {
    raceLabels[raceId] =
      resolveFromCatalogs(dataset, locale, (catalog) => catalog.raceLabels?.[raceId]) ??
      dataset.raceLabels?.[raceId] ??
      (raceId === RACE_UNAVAILABLE_ID ? 'Unavailable' : raceId)
  }

  // Preserve canonical operator order. Locale switching must only change display
  // strings, never the solver/randomizer input ordering or source-derived IDs.
  const operators = dataset.operators.map((operator) => ({
    ...operator,
    name:
      resolveFromCatalogs(dataset, locale, (catalog) => catalog.operatorNames[operator.id]) ??
      operator.name,
    subclass: {
      ...operator.subclass,
      name:
        resolveFromCatalogs(
          dataset,
          locale,
          (catalog) => catalog.subclassLabels[operator.subclass.id],
        ) ?? operator.subclass.name,
    },
  }))

  return {
    ...dataset,
    classLabels,
    factionLabels,
    raceLabels,
    operators,
  }
}
