import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from './constraints'
import type { Operator } from './operator'
import {
  applyManualOperatorExclusions,
  buildFinalOperatorPool,
  setDisplayedOperatorsExcluded,
} from './operatorPool'
import { filterHigherLevelEligibleOperators } from './randomizer'

function operator(index: number): Operator {
  const operatorClass = [
    'Vanguard',
    'Guard',
    'Defender',
    'Sniper',
    'Caster',
    'Medic',
    'Supporter',
    'Specialist',
  ][index % 8] as Operator['class']
  const rarity = ((index % 6) + 1) as Operator['rarity']
  const yearGroup = index % 8
  const year = 2019 + yearGroup

  return {
    id: `char_perf_${String(index).padStart(4, '0')}`,
    name: `Performance Operator ${index}`,
    rarity,
    class: operatorClass,
    subclass: { id: `subclass_${operatorClass.toLowerCase()}`, name: `${operatorClass} branch` },
    faction: {
      main: `faction_${index % 12}`,
      affiliations: [`faction_${index % 12}`],
    },
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: `${year}-01-01`, yearGroup },
      global: { date: `${year}-01-01`, yearGroup },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `operators/char_perf_${index}.png`,
  }
}

describe('Pool behavior with a growing roster', () => {
  it('keeps higher-level, manual exclusion, and bulk-action semantics stable past 500 operators', () => {
    const roster = Array.from({ length: 600 }, (_, index) => operator(index))
    const constraints = createDefaultConstraints()
    constraints.release.minYear = 2
    constraints.release.maxYear = 6
    constraints.faction.excludedIds = ['faction_0', 'faction_1']
    constraints.subclass.excludedIds = ['subclass_guard']

    const higherLevel = filterHigherLevelEligibleOperators(roster, constraints)
    expect(higherLevel.length).toBeGreaterThan(200)
    expect(higherLevel.length).toBeLessThan(600)
    expect(new Set(higherLevel.map(({ id }) => id)).size).toBe(higherLevel.length)

    const initiallyExcluded = higherLevel
      .filter((_, index) => index % 7 === 0)
      .map(({ id }) => id)
    const finalPool = buildFinalOperatorPool(roster, constraints, initiallyExcluded)

    expect(finalPool).toEqual(
      applyManualOperatorExclusions(higherLevel, initiallyExcluded),
    )
    expect(finalPool.every(({ id }) => !initiallyExcluded.includes(id))).toBe(true)

    const displayed = higherLevel.slice(25, 175).map(({ id }) => id)
    const afterBulkRemove = setDisplayedOperatorsExcluded(
      initiallyExcluded,
      displayed,
      true,
    )
    expect(displayed.every((id) => afterBulkRemove.includes(id))).toBe(true)

    const unrelatedBefore = initiallyExcluded.filter((id) => !displayed.includes(id))
    const afterBulkAdd = setDisplayedOperatorsExcluded(
      afterBulkRemove,
      displayed,
      false,
    )
    expect(afterBulkAdd).toEqual(unrelatedBefore)
  })

  it('does not accidentally exclude newly-added operators when an older explicit exclusion set is reused', () => {
    const originalRoster = Array.from({ length: 500 }, (_, index) => operator(index))
    const expandedRoster = Array.from({ length: 650 }, (_, index) => operator(index))
    const constraints = createDefaultConstraints()
    const explicitExclusions = originalRoster
      .filter((_, index) => index % 10 === 0)
      .map(({ id }) => id)

    const expandedPool = buildFinalOperatorPool(
      expandedRoster,
      constraints,
      explicitExclusions,
    )

    const newIds = new Set(expandedRoster.slice(500).map(({ id }) => id))
    expect(expandedPool.filter(({ id }) => newIds.has(id))).toHaveLength(150)
  })
})
