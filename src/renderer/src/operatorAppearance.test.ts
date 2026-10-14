import { describe, expect, it } from 'vitest'
import type { Operator } from '../../shared/operator'
import {
  appearanceLabel,
  resolveAppearanceChoice,
  resolveRandomAppearance,
} from './operatorAppearance'

const operator: Operator = {
  id: 'char_222_bpipe',
  name: 'Bagpipe',
  rarity: 6,
  class: 'Vanguard',
  subclass: { id: 'pioneer', name: 'Pioneer' },
  faction: { main: null, affiliations: [] },
  availableOn: { cn: true, global: true },
  release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
  acquisition: { family: 'standard', group: null },
  collaboration: null,
  alterGroup: null,
  mandatoryExclusivityGroup: null,
  imageFile: 'operators/char_222_bpipe.png',
  skins: [
    {
      id: 'char_222_bpipe@race#1',
      portraitId: 'char_222_bpipe_race#1',
      names: { en: 'Queen, No. 1' },
    },
  ],
}

describe('operator appearance resolution', () => {
  it('keeps random resolution stable for the same operator and seed', () => {
    expect(resolveRandomAppearance(operator, 123)).toBe(resolveRandomAppearance(operator, 123))
  })

  it('preserves explicit skin choices', () => {
    expect(resolveAppearanceChoice(operator, 'skin:char_222_bpipe@race#1', 1)).toBe(
      'skin:char_222_bpipe@race#1',
    )
    expect(appearanceLabel(operator, 'skin:char_222_bpipe@race#1', 'en', 1)).toBe('Queen, No. 1')
  })
})
