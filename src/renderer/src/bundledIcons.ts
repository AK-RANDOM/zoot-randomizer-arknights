const root = '../../../resources/bundled-data/operators'
const icons = import.meta.glob<string>(
  '../../../resources/bundled-data/operators/{class-icons,subclass-icons,faction-icons}/*.png',
  { eager: true, import: 'default', query: '?url&no-inline' },
)

export function bundledIconUrl(
  directory: 'class-icons' | 'subclass-icons' | 'faction-icons',
  filename: string | null,
): string | null {
  return filename ? (icons[`${root}/${directory}/${filename}`] ?? null) : null
}
