import { app } from 'electron'
import { join } from 'node:path'
import { ArtworkCache } from './artworkCache'

let cache: ArtworkCache | undefined
export function operatorArtworkCache(): ArtworkCache {
  return (cache ??= new ArtworkCache({
    root: join(app.getPath('userData'), 'operator-data'),
    bundledRoot: app.isPackaged
      ? join(process.resourcesPath, 'bundled-data/operators')
      : join(app.getAppPath(), 'resources/bundled-data/operators'),
  }))
}
