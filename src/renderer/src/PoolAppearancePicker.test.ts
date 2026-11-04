import { describe, expect, it } from 'vitest'
import { randomOutfitChoice } from './PoolAppearancePicker'

describe('Random Outfit action', () => {
  it('returns concrete choices matching the picker rather than a random mode or default skin alias', () => {
    const operator = {
      id: 'test',
      defaultArts: [{ id: 'base' }, { id: 'elite2' }],
      skins: [{ id: 'base', isDefault: true }, { id: 'outfit' }],
    }
    expect(randomOutfitChoice(operator, () => 0)).toBe('e1')
    expect(randomOutfitChoice(operator, () => 0.4)).toBe('e2')
    expect(randomOutfitChoice(operator, () => 0.99)).toBe('skin:outfit')
  })
  it('uses only the available default for Amiya forms without alternate outfits', () => {
    expect(randomOutfitChoice({ id: 'char_1001_amiya2' }, () => 0.99)).toBe('e2')
  })
})
