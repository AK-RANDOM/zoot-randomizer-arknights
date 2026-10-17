import { describe, expect, it } from 'vitest'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import type { Operator } from '../../shared/operator'
import {
  appearanceLabel,
  resolveAccountAppearance,
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
  defaultArts: [
    {
      id: 'char_222_bpipe#1',
      avatarId: 'char_222_bpipe_1',
      portraitId: 'char_222_bpipe_1',
      phase: 0,
      label: 'E1',
    },
    {
      id: 'char_222_bpipe#2',
      avatarId: 'char_222_bpipe_2',
      portraitId: 'char_222_bpipe_2',
      phase: 2,
      label: 'E2',
    },
  ],
  skins: [
    {
      id: 'char_222_bpipe@race#1',
      portraitId: 'char_222_bpipe_race#1',
      names: { en: 'Queen, No. 1' },
    },
  ],
}

function snapshot(equippedSkinId?: string): ImportedArknightsAccount {
  return {
    schemaVersion: 1,
    server: 'en',
    fetchedAt: '2026-10-17T00:00:00.000Z',
    operators: [{ operatorId: operator.id, level: 90, elite: 2, equippedSkinId }],
    ownedSkinIds: [],
  }
}

describe('operator appearance resolution', () => {
  it('keeps random resolution stable for the same operator and seed', () => {
    expect(resolveRandomAppearance(operator, 123)).toBe(resolveRandomAppearance(operator, 123))
  })

  it('preserves explicit skin choices even when account appearance exists', () => {
    const account = resolveAccountAppearance(operator, snapshot('char_222_bpipe#2'))
    expect(resolveAppearanceChoice(operator, 'skin:char_222_bpipe@race#1', 1, account.choice)).toBe(
      'skin:char_222_bpipe@race#1',
    )
    expect(appearanceLabel(operator, 'skin:char_222_bpipe@race#1', 'en', 1, account)).toBe(
      'Queen, No. 1',
    )
  })

  it('resolves explicit account mode to the imported equipped selectable skin', () => {
    const account = resolveAccountAppearance(operator, snapshot('char_222_bpipe@race#1'))
    expect(account).toEqual({
      equippedSkinId: 'char_222_bpipe@race#1',
      choice: 'skin:char_222_bpipe@race#1',
      recognized: true,
    })
    expect(resolveAppearanceChoice(operator, 'account', 1, account.choice)).toBe(
      'skin:char_222_bpipe@race#1',
    )
    expect(appearanceLabel(operator, 'account', 'en', 1, account)).toBe(
      'Account equipped · Queen, No. 1',
    )
  })

  it('maps current-main defaultArts account skins to promotion artwork', () => {
    expect(resolveAccountAppearance(operator, snapshot('char_222_bpipe#1')).choice).toBe('e1')
    expect(resolveAccountAppearance(operator, snapshot('char_222_bpipe#2')).choice).toBe('e2')
  })

  it('uses a safe E2 fallback when the imported equipped skin is unknown locally', () => {
    const account = resolveAccountAppearance(operator, snapshot('char_222_bpipe@future#1'))
    expect(account.recognized).toBe(false)
    expect(account.choice).toBeNull()
    expect(resolveAppearanceChoice(operator, 'account', 1, account.choice)).toBe('e2')
    expect(appearanceLabel(operator, 'account', 'en', 1, account)).toContain('E2 fallback')
  })
})
