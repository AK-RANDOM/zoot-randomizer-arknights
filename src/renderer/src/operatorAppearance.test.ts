import { describe, expect, it } from 'vitest'
import {
  type OperatorPreferences,
  createDefaultOperatorPreferences,
  normalizeOperatorPreferences,
} from '../../shared/operatorPool'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AppearancePicker, { randomOutfitChoice } from './PoolAppearancePicker'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import type { Operator } from '../../shared/operator'
import {
  appearanceLabel,
  changeAppearanceRegion,
  appearanceAvailableInRegion,
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

  it('treats Amiya Guard and Medic patched defaults as Elite 2 account art', () => {
    for (const [id, name, klass] of [
      ['char_1001_amiya2', 'Amiya (Guard)', 'Guard'],
      ['char_1037_amiya3', 'Amiya (Medic)', 'Medic'],
    ] as const) {
      const form: Operator = {
        ...operator,
        id,
        name,
        class: klass,
        defaultArts: [
          {
            id: `${id}#2`,
            avatarId: `${id}_2`,
            portraitId: `${id}_2`,
            label: 'Default',
          },
        ],
        skins: [],
      }
      const formSnapshot: ImportedArknightsAccount = {
        ...snapshot(),
        operators: [{ operatorId: id, level: 90, elite: 2, equippedSkinId: `${id}#2` }],
      }
      expect(resolveAccountAppearance(form, formSnapshot).choice).toBe('e2')
    }
  })

  it('uses a safe E2 fallback when the imported equipped skin is unknown locally', () => {
    const account = resolveAccountAppearance(operator, snapshot('char_222_bpipe@future#1'))
    expect(account.recognized).toBe(false)
    expect(account.choice).toBeNull()
    expect(resolveAppearanceChoice(operator, 'account', 1, account.choice)).toBe('e2')
    expect(appearanceLabel(operator, 'account', 'en', 1, account)).toContain('E2 fallback')
  })
})

const cnOnly = { id: 'cn-only', portraitId: 'cn-only', names: { cn: 'CN exclusive' } }
const regionalOperator: Operator = { ...operator, skins: [...operator.skins!, cnOnly] }
const enOutfit = 'skin:char_222_bpipe@race#1' as const

function regionalPreferences(
  choice: 'e1' | 'e2' | 'random' | 'account' = 'e2',
): OperatorPreferences {
  return {
    ...createDefaultOperatorPreferences(),
    metadataRegion: 'cn' as const,
    defaultAppearance: choice,
    operatorAppearances: { [operator.id]: 'skin:cn-only' as const },
  }
}

describe('regional outfit selection', () => {
  it('hides CN-only outfits in the EN picker independently of display language', () => {
    const preferences: OperatorPreferences = {
      ...regionalPreferences(),
      metadataRegion: 'global',
      gameLocale: 'cn' as const,
    }
    const render = () =>
      renderToStaticMarkup(
        createElement(AppearancePicker, {
          operator: regionalOperator,
          preferences,
          importedAccount: null,
          onChoose: () => undefined,
          onClose: () => undefined,
        }),
      )
    expect(render()).toContain('Queen, No. 1')
    expect(render()).not.toContain('CN exclusive')
    preferences.metadataRegion = 'cn'
    expect(render()).toContain('CN exclusive')
  })

  it.each(['e1', 'e2', 'account'] as const)(
    'replaces CN-only selection using %s default on CN to EN',
    (defaultAppearance) => {
      const next = changeAppearanceRegion(
        regionalPreferences(defaultAppearance),
        [regionalOperator],
        'global',
      )
      expect(next.operatorAppearances[operator.id]).toBe(
        defaultAppearance === 'account' ? 'e2' : defaultAppearance,
      )
      expect(next.metadataRegion).toBe('global')
    },
  )

  it('uses only EN outfits for random fallbacks and both random selection actions', () => {
    for (let seed = 0; seed < 100; seed++) {
      const preferences = { ...regionalPreferences('random'), appearanceRandomSeed: seed }
      const next = changeAppearanceRegion(preferences, [regionalOperator], 'global')
      expect(
        appearanceAvailableInRegion(
          regionalOperator,
          resolveAppearanceChoice(
            regionalOperator,
            next.operatorAppearances[operator.id],
            seed,
            null,
            'global',
          ),
          'global',
        ),
      ).toBe(true)
      expect(resolveRandomAppearance(regionalOperator, seed, 'global')).not.toBe('skin:cn-only')
    }
    expect(randomOutfitChoice(regionalOperator, () => 0.99, 'global')).toBe(enOutfit)
    expect(randomOutfitChoice(regionalOperator, () => 0.99, 'cn')).toBe('skin:cn-only')
  })

  it('preserves available selections on CN to EN and EN to CN without restoring the removed CN outfit', () => {
    const preferences = regionalPreferences('e1')
    preferences.operatorAppearances[operator.id] = enOutfit
    const en = changeAppearanceRegion(preferences, [regionalOperator], 'global')
    expect(en.operatorAppearances).toEqual(preferences.operatorAppearances)
    expect(changeAppearanceRegion(en, [regionalOperator], 'cn').operatorAppearances).toEqual(
      en.operatorAppearances,
    )
    const fallback = changeAppearanceRegion(regionalPreferences('e1'), [regionalOperator], 'global')
    expect(
      changeAppearanceRegion(fallback, [regionalOperator], 'cn').operatorAppearances[operator.id],
    ).toBe('e1')
  })

  it('preserves displayed random outfits in both switch directions', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const source of ['global', 'cn'] as const) {
        const preferences = {
          ...regionalPreferences(),
          metadataRegion: source,
          appearanceRandomSeed: seed,
          operatorAppearances: { [operator.id]: 'random' as const },
        }
        const before = resolveRandomAppearance(regionalOperator, seed, source)
        const target = source === 'cn' ? 'global' : 'cn'
        const next = changeAppearanceRegion(preferences, [regionalOperator], target)
        const after = resolveAppearanceChoice(
          regionalOperator,
          next.operatorAppearances[operator.id],
          seed,
          null,
          target,
        )
        expect(after).toBe(
          appearanceAvailableInRegion(regionalOperator, before, target) ? before : 'e2',
        )
      }
    }
  })

  it('prevents account-equipped CN outfits and stale explicit choices leaking into EN', () => {
    const account = snapshot('cn-only')
    expect(resolveAccountAppearance(regionalOperator, account, 'global').choice).toBeNull()
    expect(resolveAppearanceChoice(regionalOperator, 'skin:cn-only', 1, null, 'global')).toBe('e2')
    const preferences = {
      ...regionalPreferences('e1'),
      operatorAppearances: { [operator.id]: 'account' as const },
    }
    expect(
      changeAppearanceRegion(preferences, [regionalOperator], 'global', account)
        .operatorAppearances[operator.id],
    ).toBe('e1')
  })

  it('persists the applied default and safely migrates older preferences', () => {
    expect(
      normalizeOperatorPreferences({ ...regionalPreferences('account') }).defaultAppearance,
    ).toBe('account')
    expect(normalizeOperatorPreferences({ version: 7 }).defaultAppearance).toBe('e2')
    expect(
      normalizeOperatorPreferences({ version: 7, defaultAppearance: 'invalid' }).defaultAppearance,
    ).toBe('e2')
  })
})
