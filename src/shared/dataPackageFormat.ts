import type { DataPackageManifest } from './dataPackage.ts'

/** Numeric index keys follow JSON enumeration order; other keys use UTF-16 code-unit order. */
export function canonicalPackageJson(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, entry: unknown) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          return Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, (entry as Record<string, unknown>)[key]]),
          )
        }
        return entry
      },
      2,
    ) + '\n'
  )
}
export function dataPackageIdentityText(
  manifest: Omit<DataPackageManifest, 'packageId'> | DataPackageManifest,
): string {
  const { packageFormatVersion, compatibility, normalization, sources, files } = manifest
  return canonicalPackageJson({
    packageFormatVersion,
    compatibility,
    normalization,
    sources,
    files: [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  })
}
