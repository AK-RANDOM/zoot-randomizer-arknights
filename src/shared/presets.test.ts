import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import {
  BUILT_IN_SQUAD_PRESETS,
  applySquadConfiguration,
  createNoConstraintConfiguration,
  createUserPreset,
  squadConfigurationEquals,
  squadConfigurationFromConstraints,
} from './presets'

describe('squad presets', () => {
  it('defines the required built-in presets', () => {
    expect(BUILT_IN_SQUAD_PRESETS.map((preset) => preset.name)).toEqual([
      'No constraint',
      'Operation 6-7 Comp',
      'Dev recommended',
    ])

    const operation = BUILT_IN_SQUAD_PRESETS[1].configuration
    expect(operation.squadSize).toBe(12)
    expect(operation.rarity[6]).toEqual({ min: 1, max: 1 })
    expect(operation.rarity[5]).toEqual({ min: 3, max: 3 })
    expect(operation.rarity[4]).toEqual({ min: 5, max: 5 })
    expect(operation.rarity[3]).toEqual({ min: 3, max: 3 })

    const recommended = BUILT_IN_SQUAD_PRESETS[2].configuration
    expect(recommended.rarity[6]).toEqual({ min: 1, max: 1 })
    expect(recommended.rarity[5]).toEqual({ min: 5, max: 5 })
    expect(recommended.rarity[4]).toEqual({ min: 4, max: 4 })
    expect(recommended.rarityGroups.lte3).toEqual({ min: 2, max: 2 })
  })

  it('applies only squad-side configuration and preserves operator filters', () => {
    const current = createDefaultConstraints()
    current.release.server = 'cn'
    current.alterExclusivity = true

    const target = createNoConstraintConfiguration(6)
    target.class.Guard = { min: 1, max: 2 }
    const applied = applySquadConfiguration(current, target)

    expect(applied.squadSize).toBe(6)
    expect(applied.class.Guard).toEqual({ min: 1, max: 2 })
    expect(applied.release.server).toBe('cn')
    expect(applied.alterExclusivity).toBe(true)
  })

  it('round-trips multi-select slot constraints without sharing arrays', () => {
    const current = createDefaultConstraints()
    current.slots[0] = { rarities: [4, 6], classes: ['Caster', 'Sniper'] }

    const extracted = squadConfigurationFromConstraints(current)
    const saved = createUserPreset('Bespoke', extracted, 'user:test')
    const clone = squadConfigurationFromConstraints(
      applySquadConfiguration(createDefaultConstraints(), saved.configuration),
    )

    expect(squadConfigurationEquals(extracted, clone)).toBe(true)
    clone.slots[0].rarities.push(5)
    expect(saved.configuration.slots[0].rarities).toEqual([4, 6])
  })
})
