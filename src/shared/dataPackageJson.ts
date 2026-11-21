import { dataPackageIdentityText } from './dataPackageFormat.ts'
export { canonicalPackageJson } from './dataPackageFormat.ts'
import { createHash } from 'node:crypto'
import type { DataPackageManifest } from './dataPackage.ts'
import * as corrections from './dataCorrections.ts'

export function dataSha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function correctionsSnapshot(): unknown {
  function jsonValue(value: unknown): unknown {
    if (value instanceof Set) return [...value].sort()
    if (Array.isArray(value)) return value.map(jsonValue)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, jsonValue(child)]),
      )
    return value
  }
  return jsonValue(corrections)
}

export function dataPackageId(
  manifest: Omit<DataPackageManifest, 'packageId'> | DataPackageManifest,
): string {
  return `sha256:${dataSha256(dataPackageIdentityText(manifest))}`
}
