import { describe, expect, it } from 'vitest'
import {
  portraitFilename,
  portraitResolutionOrder,
  resolvePortraitFilename,
} from './portraits'

describe('portrait promotion resolution', () => {
  it('uses the base portrait for E1', () => {
    const files = new Set(['char_001_amiya_1.png', 'char_001_amiya_2.png'])
    expect(resolvePortraitFilename('char_001_amiya', 'e1', files)).toBe('char_001_amiya_1.png')
  })

  it('prefers E2 and falls back to E1 when E2 is unavailable', () => {
    const files = new Set(['char_123_test_1.png'])
    expect(resolvePortraitFilename('char_123_test', 'e2', files)).toBe('char_123_test_1.png')
  })

  it('allows Amiya alternate forms to use their E2-style portrait for E1', () => {
    const guardFiles = new Set(['char_1001_amiya2_2.png'])
    const medicFiles = new Set(['char_1037_amiya3_2.png'])
    expect(resolvePortraitFilename('char_1001_amiya2', 'e1', guardFiles)).toBe(
      'char_1001_amiya2_2.png',
    )
    expect(resolvePortraitFilename('char_1037_amiya3', 'e1', medicFiles)).toBe(
      'char_1037_amiya3_2.png',
    )
  })

  it('does not treat an E2-only normal operator as valid E1 coverage', () => {
    const files = new Set(['char_123_test_2.png'])
    expect(resolvePortraitFilename('char_123_test', 'e1', files)).toBeNull()
  })

  it('ignores skin filenames because only canonical promotion names are resolved', () => {
    const files = new Set(['char_123_test_skin1.png', 'char_123_test_1_skin.png'])
    expect(resolvePortraitFilename('char_123_test', 'e1', files)).toBeNull()
    expect(resolvePortraitFilename('char_123_test', 'e2', files)).toBeNull()
  })

  it('builds only canonical portrait filenames', () => {
    expect(portraitFilename('char_123_test', 1)).toBe('char_123_test_1.png')
    expect(portraitResolutionOrder('char_123_test', 'e2')).toEqual([2, 1])
  })
})
