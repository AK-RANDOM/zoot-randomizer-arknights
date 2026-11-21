import type { PromotionArt } from '../shared/portraits'
import { artworkAsset } from '../shared/artwork'
import { operatorArtworkCache } from './operatorArtwork'
import { getOperatorDataset } from './operatorDataService'
export function clearAvatarMemoryCaches(): void {
  operatorArtworkCache().clearMemory()
}
export async function getOperatorAvatarAsset(avatarId: string): Promise<string | null> {
  if (!/^[a-z0-9_@#+-]+$/i.test(avatarId)) return null
  return operatorArtworkCache().image(artworkAsset('avatar', avatarId + '.png'))
}
export async function getOperatorPromotionAvatar(
  operatorId: string,
  promotionArt: PromotionArt,
): Promise<string | null> {
  if (!/^char_[a-z0-9_]+$/i.test(operatorId) || !['e1', 'e2'].includes(promotionArt)) return null
  const operator = (await getOperatorDataset()).operators.find(
    (candidate) => candidate.id === operatorId,
  )
  if (!operator) return null
  const arts = operator.defaultArts ?? []
  const preferred =
    promotionArt === 'e2'
      ? (arts.find((art) => art.phase === 2) ?? arts.at(-1))
      : (arts.find((art) => art.phase === 0) ?? arts[0])
  if (preferred) return getOperatorAvatarAsset(preferred.avatarId)
  const fallback = await getOperatorAvatarAsset(
    promotionArt === 'e1' ? operatorId : operatorId + '_2',
  )
  return fallback ?? (promotionArt === 'e2' ? getOperatorAvatarAsset(operatorId) : null)
}
