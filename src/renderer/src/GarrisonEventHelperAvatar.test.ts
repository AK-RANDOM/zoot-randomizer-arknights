import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const feature = readFileSync(new URL('./GarrisonSquadFeature.tsx', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('./GarrisonEventHelperAvatar.tsx', import.meta.url), 'utf8')

describe('Garrison quick-add helper portrait', () => {
  it('appears before the event select, but not inside the native dropdown', () => {
    expect(feature.indexOf('<GarrisonEventHelperAvatar')).toBeLessThan(
      feature.indexOf('aria-label="Event name"'),
    )
    expect(feature).toContain(
      'garrisonEventHelperOperator(selectedEvent, operators, metadataRegion)',
    )
  })

  it('uses the fixed default E0 avatar, not current appearance or elite artwork', () => {
    expect(avatar).toContain("getOperatorPromotionAvatar(operator.id, 'e1')")
    expect(avatar).not.toContain('useOperatorAppearanceAvatar')
    expect(avatar).not.toContain('getOperatorSkinAvatar')
    expect(avatar).not.toContain("getOperatorPromotionAvatar(operator.id, 'e2')")
  })
})
