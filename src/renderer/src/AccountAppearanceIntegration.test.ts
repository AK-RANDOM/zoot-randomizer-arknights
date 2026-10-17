import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const poolPanelSource = readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8')

describe('Issue #78 M5 account appearance UI', () => {
  it('exposes explicit account-equipped mode without silently overriding user artwork', () => {
    expect(poolPanelSource).toContain('Account equipped')
    expect(poolPanelSource).toContain('explicit artwork choice wins unless you select')
    expect(poolPanelSource).toContain("choice: 'account'")
  })

  it('shows imported owned and unowned skin state without inferring ownership from equipped state', () => {
    expect(poolPanelSource).toContain('Owned on imported account')
    expect(poolPanelSource).toContain('Not owned on imported account')
    expect(poolPanelSource).toContain('is not inferred from the equipped skin')
    expect(poolPanelSource).toContain('importedAccountOwnsSkin(importedAccount, skin.id)')
  })
})
