import { describe, expect, it } from 'vitest'
import { createDefaultConstraints } from '../../shared/constraints'
import { createGarrison, type Garrison } from '../../shared/garrison'
import { startDraft, pickDraftOperator } from '../../shared/draft'
import { generateSquad } from '../../shared/randomizer'
import type { Operator } from '../../shared/operator'
import { garrisonDispatchExclusions, garrisonDispatchPool } from './garrisonDispatch'

const operators: Operator[] = Array.from({ length: 16 }, (_, index) => ({
  id: `operator-${index}`, name: `Operator ${index}`, rarity: 4, class: 'Guard',
  subclass: { id: 'lord', name: 'Lord' }, faction: { main: 'rhodes', affiliations: ['rhodes'] },
  availableOn: { cn: true, global: true },
  release: { cn: { date: '2024-01-01', yearGroup: 5 }, global: { date: '2024-01-01', yearGroup: 5 } },
  acquisition: { family: 'standard', group: null }, collaboration: null,
  alterGroup: null, mandatoryExclusivityGroup: null, imageFile: 'test.png',
}))

function garrison(): Garrison {
  return { ...createGarrison(), duplicateOperatorsAllowed: false, stages: [
    { id: 'first', name: 'First stage', operatorIds: ['operator-0', 'operator-1'] },
    { id: 'second', name: 'Second stage', operatorIds: ['operator-2'] },
  ] }
}

describe('Garrison linked generation', () => {
  it('excludes assignments in other stages while allowing regeneration of the target stage', () => {
    const document = garrison()
    expect(garrisonDispatchExclusions(document, 'second')).toEqual(['operator-0', 'operator-1'])
    expect(garrisonDispatchExclusions(document, 'new-stage')).toEqual(['operator-0', 'operator-1', 'operator-2'])
    document.duplicateOperatorsAllowed = true
    expect(garrisonDispatchExclusions(document, 'second')).toEqual([])
  })

  it('never changes the source pool or Garrison during Standard and Draft generation', () => {
    const document = garrison()
    const before = structuredClone(document)
    const originalPool = [...operators]
    const pool = garrisonDispatchPool(operators, garrisonDispatchExclusions(document, 'second'))
    const constraints = createDefaultConstraints()
    constraints.squadSize = 12
    const squad = generateSquad(pool, constraints)
    expect(squad).toHaveLength(12)
    expect(squad.some((operator) => ['operator-0', 'operator-1'].includes(operator.id))).toBe(false)
    let draft = startDraft(pool, 12, { random: () => 0 })
    while (draft.status === 'active') {
      expect(draft.currentOfferIds.some((id) => ['operator-0', 'operator-1'].includes(id))).toBe(false)
      draft = pickDraftOperator(draft, pool, draft.currentOfferIds[0], { random: () => 0 })
    }
    expect(draft.draftedOperatorIds).toHaveLength(12)
    expect(document).toEqual(before)
    expect(operators).toEqual(originalPool)
    expect(garrisonDispatchPool(operators, [])).toEqual(originalPool)
  })

  it('does not introduce operators outside the eligible source pool', () => {
    const source = operators.slice(0, 3)
    expect(garrisonDispatchPool(source, ['operator-0', 'not-in-source']).map((operator) => operator.id))
      .toEqual(['operator-1', 'operator-2'])
    expect(garrisonDispatchPool(source, source.map((operator) => operator.id))).toEqual([])
  })
})
