import type { PromotionArt } from '../shared/portraits'
import { portraitResolutionOrder } from '../shared/portraits'
import { artworkAsset } from '../shared/artwork'
import { getOperatorDataset } from './operatorDataService'
import { operatorArtworkCache } from './operatorArtwork'
export function clearPortraitMemoryCaches(): void {
  operatorArtworkCache().clearMemory()
}
export async function getOperatorPortrait(
  operatorId: string,
  promotionArt: PromotionArt,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId) || !['e1', 'e2'].includes(promotionArt)) return null
  if (!(await getOperatorDataset()).operators.some((operator) => operator.id === operatorId))
    return null
  for (const phase of portraitResolutionOrder(operatorId, promotionArt)) {
    const image = await operatorArtworkCache().cachedImage(
      artworkAsset('portrait', `${operatorId}_${phase}.png`),
    )
    if (image) return image
  }
  for (const phase of portraitResolutionOrder(operatorId, promotionArt)) {
    const image = await operatorArtworkCache().image(
      artworkAsset('portrait', operatorId + '_' + phase + '.png'),
    )
    if (image) return image
  }
  return null
}
export async function getOperatorSkinPortrait(
  operatorId: string,
  skinId: string,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  const skin = (await getOperatorDataset()).operators
    .find((operator) => operator.id === operatorId)
    ?.skins?.find((skin) => skin.id === skinId)
  return skin
    ? operatorArtworkCache().image(artworkAsset('portrait', skin.portraitId + '.png'))
    : null
}
export async function getOperatorSkinAvatar(
  operatorId: string,
  skinId: string,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId)) return null
  const skin = (await getOperatorDataset()).operators
    .find((operator) => operator.id === operatorId)
    ?.skins?.find((skin) => skin.id === skinId)
  return skin?.avatarId
    ? operatorArtworkCache().image(artworkAsset('avatar', skin.avatarId + '.png'))
    : null
}
