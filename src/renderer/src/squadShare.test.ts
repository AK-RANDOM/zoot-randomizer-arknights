import { describe, expect, it } from 'vitest'
import type { Operator } from '../../shared/operator'
import { formatSquadShareText, squadShareImageSlots, type SquadShareResult } from './squadShare'

const silverAsh: Operator = {
  id: 'silverash',
  name: 'SilverAsh',
  rarity: 6,
  class: 'Guard',
  subclass: { id: 'lord', name: 'Lord' },
  faction: { main: 'kjerag', affiliations: ['kjerag'] },
  availableOn: { cn: true, global: true },
  release: {
    cn: { date: null, yearGroup: null },
    global: { date: null, yearGroup: null },
  },
  acquisition: { family: 'standard', group: null },
  collaboration: null,
  alterGroup: null,
  mandatoryExclusivityGroup: null,
  imageFile: 'silverash.png',
}
const amiya: Operator = { ...silverAsh, id: 'amiya', name: 'Amiya', rarity: 5 }
const generatedAt = new Date(2026, 10, 13)

describe('squad sharing', () => {
  it('formats the local generation date and numbers filled members in squad order', () => {
    expect(
      formatSquadShareText({
        mode: 'Standard Mode',
        generatedAt,
        members: [silverAsh, null, amiya],
      }),
    ).toBe(
      'ZOOT Squad Dispatcher\nStandard Mode\nGenerated: 13 November 2026\n\nMembers\n1. 6* SilverAsh\n2. 5* Amiya',
    )
  })

  it('places a Draft overflow operator in slot 12 with empty slots between filled cards', () => {
    const result: SquadShareResult = {
      mode: 'Draft Mode',
      generatedAt,
      members: [silverAsh, amiya],
      overflowStart: 1,
    }
    const slots = squadShareImageSlots(result)
    expect(slots).toHaveLength(12)
    expect(slots[0]).toEqual({ operator: silverAsh, isOverflow: false })
    expect(slots.slice(1, 11)).toEqual(Array(10).fill({ operator: null, isOverflow: false }))
    expect(slots[11]).toEqual({ operator: amiya, isOverflow: true })
    expect(formatSquadShareText(result)).toContain('2. 5* Amiya')
  })

  it('keeps all drafted operators when a Rulebook allows multiple overflow slots', () => {
    const chen: Operator = { ...silverAsh, id: 'chen', name: "Ch'en" }
    const slots = squadShareImageSlots({
      mode: 'Draft Mode',
      generatedAt,
      members: [silverAsh, amiya, chen],
      overflowStart: 1,
    })
    expect(slots.slice(10)).toEqual([
      { operator: amiya, isOverflow: true },
      { operator: chen, isOverflow: true },
    ])
    expect(slots.flatMap(({ operator }) => (operator ? [operator] : []))).toEqual([
      silverAsh,
      amiya,
      chen,
    ])
  })
})
