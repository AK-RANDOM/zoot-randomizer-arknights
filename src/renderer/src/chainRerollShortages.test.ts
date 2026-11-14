import { describe, expect, it } from 'vitest'
import { BUILT_IN_SQUAD_PRESETS } from '../../shared/presets'
import { operatorMatchesSlotConstraint } from '../../shared/randomizer'
import type { Operator, OperatorRarity } from '../../shared/operator'
import { rarityShortageMessage, slotsWithReplacementShortages } from './chainRerollShortages'

describe('Chain Mode replacement shortages', () => {
  it('explains that two low-rarity slots share one remaining operator', () => {
    const lowRarities = [1, 2, 3] as const
    const available = [6, 6, 5, 5, 3] as const
    expect(
      rarityShortageMessage(lowRarities, 2, [], [lowRarities, lowRarities], available, '3★ or lower'),
    ).toBe('3★ or lower: 2 needed, 1 left')
    expect(
      rarityShortageMessage(lowRarities, 2, [3], [lowRarities], available, '3★ or lower'),
    ).toBeUndefined()
  })

  it('flags both low-rarity slots while four-star slots also lack replacements', () => {
    const preset = BUILT_IN_SQUAD_PRESETS.find(({ id }) => id === 'builtin:dev-recommended')!
    const rarities: OperatorRarity[] = [6, 5, 5, 5, 5, 5, 4, 4, 4, 3]
    const replacements = rarities.map((rarity, index) => ({ id: String(index), rarity }))
    const candidates = new Map(
      preset.configuration.slots.map((constraint, slot) => [
        slot,
        replacements
          .filter((operator) => operatorMatchesSlotConstraint(operator as Operator, constraint))
          .map(({ id }) => id),
      ]),
    )

    expect(slotsWithReplacementShortages(candidates)).toEqual(new Set([6, 7, 8, 9, 10, 11]))

    for (const kept of [6, 7, 8, 9]) candidates.delete(kept)
    expect(slotsWithReplacementShortages(candidates)).toEqual(new Set([10, 11]))
    candidates.delete(10)
    expect(slotsWithReplacementShortages(candidates)).toEqual(new Set())
  })

  it('only flags slots that compete for a replacement when another slot has its own', () => {
    const candidates = new Map([
      [0, ['a', 'b']],
      [1, ['a']],
      [2, ['a']],
      [3, []],
    ])

    expect(slotsWithReplacementShortages(candidates)).toEqual(new Set([1, 2, 3]))
  })
})
