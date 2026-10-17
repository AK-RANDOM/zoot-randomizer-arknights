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
    expect(poolPanelSource).not.toContain('Account data is advisory')
    expect(poolPanelSource).not.toContain('explicit artwork choice wins unless you select')
    expect(poolPanelSource).toContain("choice: 'account'")
  })

  it('shows imported owned and unowned skin state without inferring ownership from equipped state', () => {
    expect(poolPanelSource).toContain("? 'Owned'")
    expect(poolPanelSource).toContain(": 'Not Owned'")
    expect(poolPanelSource).not.toContain('Owned on imported account')
    expect(poolPanelSource).not.toContain('Not owned on imported account')
    expect(poolPanelSource).not.toContain('is not inferred from the equipped skin')
    expect(poolPanelSource).toContain('importedAccountOwnsSkin(importedAccount, skin.id)')
  })

  it('scrolls outfit names only when the popup label overflows', () => {
    expect(poolPanelSource).toContain('ScrollingOutfitName')
    expect(poolPanelSource).toContain('label.scrollWidth - viewport.clientWidth')
    expect(poolPanelCss).toContain('.pool-appearance-outfit-name.is-overflowing')
    expect(poolPanelCss).toContain('animation: pool-appearance-text-scroll')
  })

  it('uses full Elite labels for base E1 and E2 art choices', () => {
    expect(poolPanelSource).toContain("if (choice === 'e1') return 'Elite 1'")
    expect(poolPanelSource).toContain("if (choice === 'e2') return 'Elite 2'")
    expect(poolPanelSource).toContain("choice === 'e1' ? 'Elite 1' : 'Elite 2'")
  })

  it('uses phase-specific Amiya labels and Elite 2 defaults for Guard and Medic', () => {
    expect(poolPanelSource).toContain("const AMIYA_CASTER_ID = 'char_002_amiya'")
    expect(poolPanelSource).toContain('return `Elite ${defaultArt.phase}`')
    expect(poolPanelSource).toContain("'char_1001_amiya2'")
    expect(poolPanelSource).toContain("'char_1037_amiya3'")
    expect(poolPanelSource).toContain("AMIYA_E2_DEFAULT_FORM_IDS.has(operatorId) ? 'e2' : 'e1'")
  })
})

const poolPanelCss = readFileSync(new URL('./PoolPanel.css', import.meta.url), 'utf8')

const optionsSource = readFileSync(new URL('./OptionsPanel.tsx', import.meta.url), 'utf8')
const globalFilterSource = readFileSync(new URL('./GlobalPoolFeature.tsx', import.meta.url), 'utf8')
const globalFilterCss = readFileSync(new URL('./GlobalPoolFeature.css', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const operatorCardSource = readFileSync(new URL('./OperatorCard.tsx', import.meta.url), 'utf8')

const accountStateSource = readFileSync(
  new URL('./arknightsAccountState.ts', import.meta.url),
  'utf8',
)

describe('Issue #78 follow-up account UX', () => {
  it('places compact account management at the top of Options without an Account subtab', () => {
    expect(optionsSource).toContain('<ArknightsAccountPanel dataset={dataset} />')
    expect(optionsSource).not.toContain("['preferences', 'Preferences']")
    expect(optionsSource).not.toContain("['account', 'Account']")
    expect(optionsSource).not.toContain("activeSection === 'account'")
  })

  it('uses a dropdown plus Apply button for bulk appearance actions', () => {
    expect(optionsSource).toContain('bulkAppearanceChoice')
    expect(optionsSource).toContain('<option value="account">Sync account outfits</option>')
    expect(optionsSource).toContain('onBulkAppearanceChange(bulkAppearanceChoice)')
    expect(optionsSource).toContain('Apply')
    expect(optionsSource).toContain('className="secondary-button"')
    expect(optionsSource).not.toContain('artwork-choice-group')
    expect(appSource).toContain("choice === 'account'")
    expect(appSource).toContain("'account' as OperatorAppearanceChoice")
  })

  it('invalidates account appearance state when equipped skins change', () => {
    expect(accountStateSource).toContain('operator.equippedSkinId')
    expect(accountStateSource).toContain('form.equippedSkinId')
  })

  it('rejects an account progression End bound lower than Start', () => {
    expect(appSource).toContain('accountProgressionRank(next.accountProgressionMax)')
    expect(appSource).toContain('accountProgressionRank(next.accountProgressionMin)')
    expect(appSource).toContain('End progression cannot be lower than Start progression.')
    expect(appSource).toContain('window.alert(')
  })

  it('moves the synced progression toggle into the Account row of Global Filter', () => {
    expect(globalFilterSource).toContain('Show synced operator progression on operator cards')
    expect(globalFilterSource).toContain('preferences.showAccountProgression')
    expect(globalFilterSource).toContain('account-global-filter__controls')
    expect(optionsSource).not.toContain('Show synced operator progression on operator cards')
    expect(operatorCardSource).not.toContain(
      "variant === 'standard' && preferences.showAccountProgression",
    )
    expect(operatorCardSource).toContain(
      'importedAccountOperatorState(importedAccount, operator.id)',
    )
    expect(operatorCardSource).toContain('operator-card__account-progression')
    expect(operatorCardSource).toContain('E${progression.elite} L${progression.level}')
    expect(operatorCardSource).toContain(": 'Not Owned'")
    expect(globalFilterCss).toContain('.account-global-filter__progression-toggle {')
    const presentationCss = readFileSync(
      new URL('./PresentationPreferences.css', import.meta.url),
      'utf8',
    )
    expect(presentationCss).toContain('.option-toggle.account-global-filter__progression-toggle {')
    expect(presentationCss).toContain('font-weight: 400')
    expect(presentationCss).toContain('border: 0')
    expect(presentationCss).toContain('background: transparent')
  })
})
