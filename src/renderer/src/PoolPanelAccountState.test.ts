import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { accountStateLabel, comparePoolGroups } from './PoolPanelPresentation'

const snapshot: ImportedArknightsAccount = {
  schemaVersion: 1,
  server: 'en',
  operators: [
    { operatorId: 'char_e0', level: 30, elite: 0 },
    {
      operatorId: 'char_amiya',
      level: 80,
      elite: 2,
      forms: [{ formId: 'char_amiya_form', level: 70, elite: 1 }],
    },
    { operatorId: 'char_e2', level: 90, elite: 2 },
  ],
  ownedSkinIds: [],
  fetchedAt: '2026-10-18T00:00:00.000Z',
}

describe('Curate account-state grouping', () => {
  it('labels owned operators and alternate forms by imported elite state', () => {
    expect(accountStateLabel({ id: 'char_e0' }, snapshot)).toBe('E0')
    expect(accountStateLabel({ id: 'char_amiya_form' }, snapshot)).toBe('E1')
    expect(accountStateLabel({ id: 'char_e2' }, snapshot)).toBe('E2')
    expect(accountStateLabel({ id: 'char_missing' }, snapshot)).toBe('Not Owned')
    expect(accountStateLabel({ id: 'char_missing' }, null)).toBe('Not Owned')
  })

  it('orders account-state groups E0, E1, E2, then Not Owned', () => {
    const entries = [
      ['E2', []],
      ['Not Owned', []],
      ['E0', []],
      ['E1', []],
    ]
    entries.sort((left, right) => comparePoolGroups(left, right, 'accountState', {}, 'asc'))
    expect(entries.map(([label]) => label)).toEqual(['E0', 'E1', 'E2', 'Not Owned'])
  })

  it('keeps the ungrouped sort control in the summary and group actions below it', () => {
    const source = readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<option value="accountState">Account State</option>')
    expect(source).toContain("onClick={() => toggleOneGroupDirection('All operators')}")
    expect(source.indexOf('<div className="pool-information" role="status">')).toBeLessThan(
      source.indexOf('<div className="pool-group-actions">'),
    )
  })
})
