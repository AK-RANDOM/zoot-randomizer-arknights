export type PromotionArt = 'e1' | 'e2'
export type PortraitPhase = 1 | 2

export const PORTRAIT_SOURCE = {
  repository: 'yuanyan3060/ArknightsGameResource',
  path: 'portrait',
  baseUrl:
    'https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/portrait',
} as const

const AMIYA_E2_AS_E1 = new Set([
  'char_1001_amiya2',
  'char_1037_amiya3',
])

export function portraitFilename(operatorId: string, phase: PortraitPhase): string {
  return `${operatorId}_${phase}.png`
}

export function portraitResolutionOrder(
  operatorId: string,
  promotionArt: PromotionArt,
): readonly PortraitPhase[] {
  if (promotionArt === 'e2') return [2, 1]
  return AMIYA_E2_AS_E1.has(operatorId) ? [1, 2] : [1]
}

export function resolvePortraitFilename(
  operatorId: string,
  promotionArt: PromotionArt,
  availableFiles: ReadonlySet<string>,
): string | null {
  for (const phase of portraitResolutionOrder(operatorId, promotionArt)) {
    const filename = portraitFilename(operatorId, phase)
    if (availableFiles.has(filename)) return filename
  }
  return null
}

export function usesAmiyaPromotionFallback(operatorId: string): boolean {
  return AMIYA_E2_AS_E1.has(operatorId)
}
