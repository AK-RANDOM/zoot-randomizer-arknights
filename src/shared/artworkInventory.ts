import type { OperatorDataset } from './operator.ts'
import { ARTWORK_POLICY_VERSION, enumerateArtwork } from './artwork.ts'
import { ARTWORK_SOURCE } from './artworkSources.ts'
import { canonicalPackageJson, dataSha256 } from './dataPackageJson.ts'

export function buildArtworkInventory(dataset: OperatorDataset, metadataPackageId: string) {
  const identity = {
    schemaVersion: 1,
    policyVersion: ARTWORK_POLICY_VERSION,
    source: ARTWORK_SOURCE,
    assets: enumerateArtwork(dataset).map(({ key, kind, filename, url, legacy }) => ({
      key,
      kind,
      filename,
      url,
      legacy,
    })),
  }
  return {
    ...identity,
    artworkId: `sha256:${dataSha256(canonicalPackageJson(identity))}`,
    metadataPackageId,
  }
}
