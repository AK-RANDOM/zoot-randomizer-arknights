import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const poolPanelSource = [
  readFileSync(new URL('./PoolPanel.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./PoolAppearancePicker.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./PoolPanelPresentation.tsx', import.meta.url), 'utf8'),
].join('\n')

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

const optionsSource = readFileSync(new URL('./OptionsPanel.tsx', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const accountStateSource = readFileSync(
  new URL('./arknightsAccountState.ts', import.meta.url),
  'utf8',
)

describe('Issue #78 follow-up account UX', () => {
  it('keeps account management in a dedicated Options subtab', () => {
    expect(optionsSource).toContain("['preferences', 'Preferences']")
    expect(optionsSource).toContain("['account', 'Account']")
    expect(optionsSource).toContain("activeSection === 'account'")
    expect(optionsSource).toContain('<ArknightsAccountPanel dataset={dataset} />')
  })

  it('supports bulk account-equipped appearance syncing', () => {
    expect(optionsSource).toContain('Sync account outfits')
    expect(optionsSource).toContain('Follow each imported operator')
    expect(appSource).toContain("choice === 'account'")
    expect(appSource).toContain("'account' as OperatorAppearanceChoice")
  })

  it('invalidates account appearance state when equipped skins change', () => {
    expect(accountStateSource).toContain('operator.equippedSkinId')
    expect(accountStateSource).toContain('form.equippedSkinId')
  })
})
