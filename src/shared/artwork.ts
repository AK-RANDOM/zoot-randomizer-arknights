import type { OperatorDataset } from './operator.ts'
import { operatorAvatarSourceFilename, legacyOperatorAvatarIds } from './operatorAvatar.ts'
import { ARTWORK_SOURCE, artworkSourceUrl } from './artworkSources.ts'

export const ARTWORK_POLICY_VERSION = 1 as const
export const LEGACY_ARTWORK_CATEGORIES = [
  'images',
  'portraits',
  'appearance-avatars',
  'skin-portraits',
  'skin-avatars',
] as const
export type ArtworkCategory = (typeof LEGACY_ARTWORK_CATEGORIES)[number]
export interface ArtworkAsset {
  key: string
  kind: 'avatar' | 'portrait'
  filename: string
  url: string
  /** Read-only compatibility locations; new downloads use the shared source-keyed cache. */
  legacy: string[]
}
export function artworkAsset(
  kind: 'avatar' | 'portrait',
  filename: string,
  aliases: string[] = [],
): ArtworkAsset {
  if (!/^[a-z0-9_@#+-]+\.png$/i.test(filename)) throw new Error('Invalid artwork filename.')
  const categories =
    kind === 'avatar' ? ['appearance-avatars', 'skin-avatars'] : ['portraits', 'skin-portraits']
  if (
    aliases.some(
      (alias) =>
        !/^(images|portraits|appearance-avatars|skin-portraits|skin-avatars)\/[a-z0-9_@#+-]+\.png$/i.test(
          alias,
        ),
    )
  )
    throw new Error('Invalid legacy artwork path.')
  return {
    kind,
    filename,
    key: `${ARTWORK_SOURCE.repository}@${ARTWORK_SOURCE.revision}/${kind}/${filename}`,
    url: artworkSourceUrl(kind, filename),
    legacy: [
      ...new Set([
        ...aliases,
        ...(kind === 'avatar'
          ? legacyOperatorAvatarIds(filename).map((id) => `images/${id}.png`)
          : []),
        ...categories.map((category) => `${category}/${filename}`),
      ]),
    ].sort(),
  }
}
export function operatorAvatarAsset(operatorId: string): ArtworkAsset {
  return artworkAsset('avatar', operatorAvatarSourceFilename(operatorId), [
    `images/${operatorId}.png`,
  ])
}
export function enumerateArtwork(dataset: Pick<OperatorDataset, 'operators'>): ArtworkAsset[] {
  const assets = new Map<string, ArtworkAsset>()
  const add = (asset: ArtworkAsset) => {
    const previous = assets.get(asset.key)
    if (previous) previous.legacy = [...new Set([...previous.legacy, ...asset.legacy])].sort()
    else assets.set(asset.key, asset)
  }
  for (const operator of dataset.operators) {
    add(operatorAvatarAsset(operator.id))
    for (const phase of [1, 2]) add(artworkAsset('portrait', `${operator.id}_${phase}.png`))
    for (const art of operator.defaultArts ?? []) add(artworkAsset('avatar', `${art.avatarId}.png`))
    for (const skin of operator.skins ?? []) {
      add(artworkAsset('portrait', `${skin.portraitId}.png`))
      if (skin.avatarId) add(artworkAsset('avatar', `${skin.avatarId}.png`))
    }
  }
  return [...assets.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}
