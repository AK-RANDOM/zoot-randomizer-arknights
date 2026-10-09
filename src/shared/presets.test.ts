import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import { operatorClasses } from './operator'
import {
  BUILT_IN_SQUAD_PRESETS,
  applySquadConfiguration,
  createNoConstraintConfiguration,
  createUserPreset,
  squadConfigurationEquals,
  squadConfigurationFromConstraints,
} from './presets'

describe('squad presets', () => {
  it('defines the required built-in presets with visible slot mappings', () => {
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
    expect(operation.slots.map((slot) => slot.rarities)).toEqual([
      [6],
      [5],
      [5],
      [5],
      [4],
      [4],
      [4],
      [4],
      [4],
      [3],
      [3],
      [3],
    ])

    const recommended = BUILT_IN_SQUAD_PRESETS[2].configuration
    expect(recommended.rarity[6]).toEqual({ min: 1, max: 1 })
    expect(recommended.rarity[5]).toEqual({ min: 5, max: 5 })
    expect(recommended.rarity[4]).toEqual({ min: 4, max: 4 })
    expect(recommended.rarityGroups.lte3).toEqual({ min: 2, max: 2 })
    for (const operatorClass of operatorClasses) {
      expect(recommended.class[operatorClass]).toEqual({ min: 1, max: 12 })
    }
    expect(recommended.slots.map((slot) => slot.rarities)).toEqual([
      [6],
      [5],
      [5],
      [5],
      [5],
      [5],
      [4],
      [4],
      [4],
      [4],
      [1, 2, 3],
      [1, 2, 3],
    ])
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

  it('applies built-in preset slot constraints directly to the active grid', () => {
    const current = createDefaultConstraints()
    const applied = applySquadConfiguration(current, BUILT_IN_SQUAD_PRESETS[1].configuration)

    expect(applied.slots[0]).toEqual({ rarities: [6], classes: [] })
    expect(applied.slots[1]).toEqual({ rarities: [5], classes: [] })
    expect(applied.slots[4]).toEqual({ rarities: [4], classes: [] })
    expect(applied.slots[9]).toEqual({ rarities: [3], classes: [] })
  })

  it('round-trips specific operator and mandatory identity slot constraints', () => {
    const exact = createDefaultConstraints()
    exact.slots[0] = { rarities: [5], classes: ['Guard'], operatorId: 'char_1001_amiya2' }
    exact.slots[1] = { rarities: [5], classes: [], mandatoryExclusivityGroup: 'amiya-forms' }

    const saved = createUserPreset(
      'Specific operators',
      squadConfigurationFromConstraints(exact),
      'user:specific',
    )
    const applied = applySquadConfiguration(createDefaultConstraints(), saved.configuration)

    expect(applied.slots[0]).toEqual({
      rarities: [5],
      classes: ['Guard'],
      operatorId: 'char_1001_amiya2',
    })
    expect(applied.slots[1]).toEqual({
      rarities: [5],
      classes: [],
      mandatoryExclusivityGroup: 'amiya-forms',
    })
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
