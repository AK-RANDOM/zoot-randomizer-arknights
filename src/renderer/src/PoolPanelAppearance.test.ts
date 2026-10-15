import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('./PoolPanel.css', import.meta.url), 'utf8')

describe('Curate operator appearance picker', () => {
  it('uses avatar assets and separates default art, skins, and random appearance', () => {
    expect(panelSource).toContain('getOperatorPromotionAvatar')
    expect(panelSource).toContain('getOperatorSkinAvatar')
    expect(panelSource).not.toContain('getOperatorSkinPortrait(operatorId, skinId)')
    expect(panelSource).toContain('Default Art')
    expect(panelSource).toContain('Skins')
    expect(panelSource).toContain('Random image')
    expect(panelSource).toContain('skinBrandName')
  })

  it('orders skins by release timestamp before rendering them', () => {
    expect(panelSource).toContain('compareSkinsByRelease')
    expect(panelSource).toContain('left.releaseTime')
    expect(panelSource).toContain('.sort(compareSkinsByRelease)')
  })

  it('caps the popup grid at five practical avatar columns and wraps narrower layouts', () => {
    expect(styleSource).toContain('width: min(660px, 100%)')
    expect(styleSource).toContain('grid-template-columns: repeat(auto-fit, minmax(112px, 1fr))')
    expect(styleSource).toContain('.pool-appearance-random')
    expect(styleSource).toContain('width: 100%')
  })
})
