import { describe, expect, it } from 'vitest'
import {
  DESKTOP_IPC_CHANNELS,
  isAllowedExternalUrl,
  requireMetadataId,
  requireOperatorClass,
  requireOperatorId,
  requirePromotionArt,
} from './desktopIpc'

describe('desktop IPC contract', () => {
  it('keeps every channel name unique', () => {
    const channels = Object.values(DESKTOP_IPC_CHANNELS)
    expect(new Set(channels).size).toBe(channels.length)
  })

  it('validates operator IDs at the desktop boundary', () => {
    expect(requireOperatorId('char_002_amiya')).toBe('char_002_amiya')
    expect(() => requireOperatorId('../operator')).toThrow('Invalid operator ID.')
    expect(() => requireOperatorId('https://example.com')).toThrow('Invalid operator ID.')
    expect(() => requireOperatorId(42)).toThrow('Invalid operator ID.')
  })

  it('validates promotion artwork values', () => {
    expect(requirePromotionArt('e1')).toBe('e1')
    expect(requirePromotionArt('e2')).toBe('e2')
    expect(() => requirePromotionArt('e3')).toThrow('Invalid promotion artwork selection.')
  })

  it('validates operator classes against the canonical class list', () => {
    expect(requireOperatorClass('Vanguard')).toBe('Vanguard')
    expect(() => requireOperatorClass('Summoner')).toThrow('Invalid operator class.')
  })

  it('accepts safe metadata IDs and rejects path or URL-like values', () => {
    expect(requireMetadataId('subclass_01', 'subclass')).toBe('subclass_01')
    expect(requireMetadataId('faction.rhodes-island', 'faction')).toBe('faction.rhodes-island')
    expect(() => requireMetadataId('../secret', 'faction')).toThrow('Invalid faction ID.')
    expect(() => requireMetadataId('https://example.com', 'faction')).toThrow('Invalid faction ID.')
    expect(() => requireMetadataId('', 'faction')).toThrow('Invalid faction ID.')
    expect(() => requireMetadataId('x'.repeat(129), 'faction')).toThrow('Invalid faction ID.')
  })

  it('only permits HTTP(S) URLs to leave the app', () => {
    expect(isAllowedExternalUrl('https://example.com/path')).toBe(true)
    expect(isAllowedExternalUrl('http://example.com/path')).toBe(true)
    expect(isAllowedExternalUrl('file:///tmp/example')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('mailto:test@example.com')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
  })
})
