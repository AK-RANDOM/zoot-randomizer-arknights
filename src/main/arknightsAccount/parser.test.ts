import { describe, expect, it } from 'vitest'
import { parseArknightsSyncData } from './parser'

const FETCHED_AT = '2026-10-15T12:34:56.000Z'

describe('Arknights account sync parser', () => {
  it('extracts ownership, progression, equipped skins, and owned skin IDs', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          troop: {
            chars: {
              '1': {
                charId: 'char_103_angel',
                level: 90,
                evolvePhase: 2,
                skin: 'char_103_angel@xmas#1',
              },
              '2': {
                charId: 'char_285_medic2',
                level: 30,
                evolvePhase: 0,
                skinId: 'char_285_medic2#1',
              },
            },
          },
          skin: {
            characterSkins: {
              'char_103_angel@xmas#1': true,
              'char_285_medic2@summer#1': { obtainedAt: 123456 },
            },
          },
        },
      },
      'en',
      FETCHED_AT,
    )

    expect(result.warnings).toEqual([])
    expect(result.snapshot).toEqual({
      schemaVersion: 1,
      server: 'en',
      fetchedAt: FETCHED_AT,
      operators: [
        {
          operatorId: 'char_103_angel',
          level: 90,
          elite: 2,
          equippedSkinId: 'char_103_angel@xmas#1',
        },
        {
          operatorId: 'char_285_medic2',
          level: 30,
          elite: 0,
          equippedSkinId: 'char_285_medic2#1',
        },
      ],
      ownedSkinIds: ['char_103_angel@xmas#1', 'char_285_medic2@summer#1'],
    })
  })

  it('extracts account display name and UID from user.status', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          status: { nickName: 'Doctor', nickNumber: 1234, uid: '08116410' },
          troop: { chars: {} },
        },
      },
      'en',
      FETCHED_AT,
    )

    expect(result.snapshot.accountName).toBe('Doctor#1234')
    expect(result.snapshot.uid).toBe('08116410')
  })

  it('preserves Amiya forms and selected currentTmpl without warning on an empty base skin', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          troop: {
            chars: {
              '1': {
                charId: 'char_002_amiya',
                level: 80,
                evolvePhase: 2,
                skin: '',
                currentTmpl: 'char_1037_amiya3',
                tmpl: {
                  char_002_amiya: { skin: 'char_002_amiya#2' },
                  char_1001_amiya2: { skin: 'char_1001_amiya2#2' },
                  char_1037_amiya3: { skin: 'char_1037_amiya3#2' },
                },
              },
            },
          },
        },
      },
      'en',
      FETCHED_AT,
    )

    expect(result.warnings).toEqual([])
    expect(result.snapshot.operators).toEqual([
      {
        operatorId: 'char_002_amiya',
        level: 80,
        elite: 2,
        activeFormId: 'char_1037_amiya3',
        equippedSkinId: 'char_1037_amiya3#2',
        forms: [
          {
            formId: 'char_002_amiya',
            level: 80,
            elite: 2,
            equippedSkinId: 'char_002_amiya#2',
          },
          {
            formId: 'char_1001_amiya2',
            level: 80,
            elite: 2,
            equippedSkinId: 'char_1001_amiya2#2',
          },
          {
            formId: 'char_1037_amiya3',
            level: 80,
            elite: 2,
            equippedSkinId: 'char_1037_amiya3#2',
          },
        ],
      },
    ])
  })

  it('accepts direct user data and the legacy phase field', () => {
    const result = parseArknightsSyncData(
      {
        troop: {
          chars: {
            '1': { charId: 'char_002_amiya', level: 80, phase: 2 },
          },
        },
      },
      'jp',
      FETCHED_AT,
    )

    expect(result.snapshot.operators).toEqual([
      { operatorId: 'char_002_amiya', level: 80, elite: 2 },
    ])
  })

  it('tolerates arbitrary characterSkins values because ownership is carried by keys', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          troop: { chars: {} },
          skin: {
            characterSkins: {
              'char_1001_amiya2@skin#1': false,
              'char_103_angel@skin#2': null,
              'char_2025_shu@skin#1': { nested: ['future', 'shape'] },
            },
          },
        },
      },
      'kr',
      FETCHED_AT,
    )

    expect(result.snapshot.ownedSkinIds).toEqual([
      'char_1001_amiya2@skin#1',
      'char_103_angel@skin#2',
      'char_2025_shu@skin#1',
    ])
  })

  it('ignores malformed optional skin data without dropping a valid operator', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          troop: {
            chars: {
              '1': {
                charId: 'char_474_glady',
                level: 60,
                evolvePhase: 2,
                skin: '../not-a-skin',
              },
            },
          },
          skin: { characterSkins: ['unexpected'] },
        },
      },
      'en',
      FETCHED_AT,
    )

    expect(result.snapshot.operators).toEqual([
      { operatorId: 'char_474_glady', level: 60, elite: 2 },
    ])
    expect(result.snapshot.ownedSkinIds).toEqual([])
    expect(result.warnings).toHaveLength(2)
  })

  it('keeps the highest progression record for duplicate operator IDs', () => {
    const result = parseArknightsSyncData(
      {
        user: {
          troop: {
            chars: {
              '1': { charId: 'char_2027_wang', level: 50, evolvePhase: 1 },
              '2': { charId: 'char_2027_wang', level: 20, evolvePhase: 2 },
            },
          },
        },
      },
      'en',
      FETCHED_AT,
    )

    expect(result.snapshot.operators).toEqual([
      { operatorId: 'char_2027_wang', level: 20, elite: 2 },
    ])
    expect(result.warnings).toContain(
      'Duplicate operator char_2027_wang was present in account sync data.',
    )
  })

  it('rejects payloads that do not contain a usable roster', () => {
    expect(() => parseArknightsSyncData({ user: {} }, 'en', FETCHED_AT)).toThrow('user.troop.chars')
    expect(() =>
      parseArknightsSyncData(
        {
          user: {
            troop: {
              chars: { '1': { charId: 'bad', level: 0, evolvePhase: 9 } },
            },
          },
        },
        'en',
        FETCHED_AT,
      ),
    ).toThrow('did not contain any valid operator records')
  })
})
