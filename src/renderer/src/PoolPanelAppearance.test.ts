import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panelSource = [
  readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./PoolAppearancePicker.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./PoolPanelPresentation.tsx', import.meta.url), 'utf8'),
].join('\n')
const styleSource = readFileSync(new URL('./PoolPanel.css', import.meta.url), 'utf8')

describe('Curate operator appearance picker', () => {
  it('uses square avatar assets and separates default art, outfits, and random appearance', () => {
    expect(panelSource).toContain('getOperatorAvatarAsset')
    expect(panelSource).toContain('getOperatorSkinAvatar')
    expect(panelSource).not.toContain('getOperatorImage(operator.id)')
    expect(panelSource).not.toContain('getOperatorSkinPortrait(operatorId, skinId)')
    expect(panelSource).toContain('operator.defaultArts')
    expect(panelSource).toContain('Default Art')
    expect(panelSource).toContain('>Outfits<')
    expect(panelSource).toContain('Random image')
    expect(panelSource).not.toContain('skinBrandName')
  })

  it('renders the Curate tile from the selected appearance rather than a fixed promotion avatar', () => {
    expect(panelSource).toContain('resolveAppearanceChoice')
    expect(panelSource).toContain('choice={appearanceChoice}')
    expect(panelSource).toContain('randomSeed={appearanceRandomSeed}')
    expect(panelSource).toContain('getOperatorSkinAvatar(operator.id, skinId)')
    expect(panelSource).not.toContain("getOperatorPromotionAvatar(operator.id, 'e1')")
  })

  it('orders only alternate outfits by release timestamp before rendering them', () => {
    expect(panelSource).toContain('compareSkinsByRelease')
    expect(panelSource).toContain('left.releaseTime')
    expect(panelSource).toContain('.filter((skin) => !skin.isDefault)')
    expect(panelSource).toContain('.sort(compareSkinsByRelease)')
  })

  it('uses the same fixed tile size for default art and outfits with a five-column dialog cap', () => {
    expect(styleSource).toContain('width: min(660px, 100%)')
    expect(styleSource).toContain('--appearance-tile-size: 112px')
    expect(styleSource).toContain(
      'grid-template-columns: repeat(auto-fill, var(--appearance-tile-size))',
    )
    expect(styleSource).toContain('width: var(--appearance-tile-size)')
    expect(styleSource).toContain('.pool-appearance-random')
  })

  it('supports variable default-art cardinality without hard-coding two tiles', () => {
    expect(panelSource).toContain('defaultArts.map')
    expect(panelSource).toContain('defaultArtChoice')
    expect(panelSource).toContain('return `skin:${defaultArt.id}`')
  })
})

const globalFilterSource = readFileSync(new URL('./GlobalPoolFeature.tsx', import.meta.url), 'utf8')

describe('Account-aware Global Filter', () => {
  it('moves active account ownership filtering into Global Filter', () => {
    expect(globalFilterSource).toContain('curateDataset')
    expect(globalFilterSource).toContain('applyAccountFilter')
    expect(globalFilterSource).toContain('Ignore account ownership')
    expect(globalFilterSource).toContain('Only shows owned operators')
    expect(globalFilterSource).toContain('Filter by operator progression')
    expect(globalFilterSource).toContain('accountProgressionMin')
    expect(globalFilterSource).toContain('accountProgressionMax')
  })
})
