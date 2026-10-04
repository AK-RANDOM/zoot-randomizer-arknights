import {
  gameLocales,
  operatorClasses,
  type GameLocale,
  type GameStringCatalog,
  type OperatorClass,
  type OperatorDataset,
} from './operator'

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
  cn: ['cn'],
}

export function isGameLocale(value: unknown): value is GameLocale {
  return typeof value === 'string' && (gameLocales as readonly string[]).includes(value)
}

const EMPTY_CATALOG: GameStringCatalog = {
  operatorNames: {},
  classLabels: {} as Record<OperatorClass, string>,
  subclassLabels: {},
  factionLabels: {},
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

  operators.sort((left, right) => {
    if (left.rarity !== right.rarity) return right.rarity - left.rarity
    return left.name.localeCompare(right.name)
  })

  return {
    ...dataset,
    classLabels,
    factionLabels,
    operators,
  }
}
