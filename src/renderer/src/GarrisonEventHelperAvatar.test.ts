import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const feature = readFileSync(new URL('./GarrisonSquadFeature.tsx', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('./GarrisonEventHelperAvatar.tsx', import.meta.url), 'utf8')

describe('Garrison quick-add helper portrait', () => {
  it('uses the shared dropdown with a regional helper for each event', () => {
    expect(feature).toContain('<EventSelectorDropdown')
    const dropdown = readFileSync(new URL('./EventSelectorDropdown.tsx', import.meta.url), 'utf8')
    expect(dropdown).toContain('<GarrisonEventHelperAvatar operator={option.representative}')
    expect(feature).toContain('garrisonEventHelperOperator(event, operators, metadataRegion)')
  })

  it('uses the fixed default E0 avatar, not current appearance or elite artwork', () => {
    expect(avatar).toContain("getOperatorPromotionAvatar(operator.id, 'e1')")
    expect(avatar).not.toContain('useOperatorAppearanceAvatar')
    expect(avatar).not.toContain('getOperatorSkinAvatar')
    expect(avatar).not.toContain("getOperatorPromotionAvatar(operator.id, 'e2')")
  })
})
