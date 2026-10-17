import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

const appearanceSource = read('./operatorAppearance.ts')
const squadSource = read('./DraftSquadGrid.tsx')
const sessionSource = read('./DraftSessionView.tsx')
const avatarHookSource = appearanceSource.slice(
  appearanceSource.indexOf('export function useOperatorAppearanceAvatar'),
)

describe('Draft square appearance avatars', () => {
  it('resolves the selected appearance through square avatar endpoints only', () => {
    expect(avatarHookSource).toContain('getOperatorPromotionAvatar(operator.id, resolved)')
    expect(avatarHookSource).toContain('getOperatorSkinAvatar(operator.id, skin.id)')
    expect(avatarHookSource).toContain('getOperatorImage(operator.id)')
    expect(avatarHookSource).not.toContain('getOperatorPortrait')
    expect(avatarHookSource).not.toContain('getOperatorSkinPortrait')
  })

  it('uses square selected-appearance avatars in Current Draft and Overflow', () => {
    expect(squadSource).toContain("import { useOperatorAppearanceAvatar } from './operatorAppearance'")
    expect(squadSource).toContain('const { imageUrl } = useOperatorAppearanceAvatar(operator)')
    expect(squadSource).not.toContain('useOperatorAppearanceImage')
  })

  it('uses the selected appearance for completed draft history icons', () => {
    expect(sessionSource).toContain("import { useOperatorAppearanceAvatar } from './operatorAppearance'")
    expect(sessionSource).toContain('function DraftHistoryOperatorIcon')
    expect(sessionSource).toContain('const { imageUrl } = useOperatorAppearanceAvatar(operator)')
    expect(sessionSource).not.toContain('.getOperatorImage(operator.id)')
  })
})
