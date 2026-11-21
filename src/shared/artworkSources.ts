/** Artwork revisions advance independently of the prepared metadata package. */
export const ARTWORK_SOURCE = {
  repository: 'yuanyan3060/ArknightsGameResource',
  revision: 'ebc29c3ccb39fe58bb129d66834eeac576559cb7',
} as const

export function artworkBaseUrl(kind: 'avatar' | 'portrait'): string {
  return `https://raw.githubusercontent.com/${ARTWORK_SOURCE.repository}/${ARTWORK_SOURCE.revision}/${kind}`
}
export function artworkSourceUrl(kind: 'avatar' | 'portrait', filename: string): string {
  return `${artworkBaseUrl(kind)}/${encodeURIComponent(filename)}`
}
