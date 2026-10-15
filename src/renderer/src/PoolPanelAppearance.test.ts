import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('./PoolPanel.css', import.meta.url), 'utf8')

describe('Curate operator appearance picker', () => {
  it('uses native avatar assets and separates default art, skins, and random appearance', () => {
    expect(panelSource).toContain('getOperatorAvatarAsset')
    expect(panelSource).toContain("getOperatorPromotionAvatar(operator.id, 'e1')")
    expect(panelSource).not.toContain('getOperatorImage(operator.id)')
    expect(panelSource).not.toContain('getOperatorSkinPortrait(operatorId, skinId)')
    expect(panelSource).toContain('operator.defaultArts')
    expect(panelSource).toContain('Default Art')
    expect(panelSource).toContain('Skins')
    expect(panelSource).toContain('Random image')
    expect(panelSource).not.toContain('skinBrandName')
  })

  it('orders only alternate skins by release timestamp before rendering them', () => {
    expect(panelSource).toContain('compareSkinsByRelease')
    expect(panelSource).toContain('left.releaseTime')
    expect(panelSource).toContain('.filter((skin) => !skin.isDefault)')
    expect(panelSource).toContain('.sort(compareSkinsByRelease)')
  })

  it('uses the same fixed tile size for default art and skins with a five-column dialog cap', () => {
    expect(styleSource).toContain('width: min(660px, 100%)')
    expect(styleSource).toContain('--appearance-tile-size: 112px')
    expect(styleSource).toContain('grid-template-columns: repeat(auto-fill, var(--appearance-tile-size))')
    expect(styleSource).toContain('width: var(--appearance-tile-size)')
    expect(styleSource).toContain('.pool-appearance-random')
  })

  it('supports variable default-art cardinality without hard-coding two tiles', () => {
    expect(panelSource).toContain('defaultArts.map')
    expect(panelSource).toContain('defaultArtChoice')
    expect(panelSource).toContain("return `skin:${defaultArt.id}`")
  })
})
