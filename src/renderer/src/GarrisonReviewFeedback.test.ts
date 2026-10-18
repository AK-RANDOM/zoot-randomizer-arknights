import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison review refinements', () => {
  it('uses name-based search in Garrison and appearance-synced selection avatars', () => {
    const picker = read('./GarrisonStageEditor.tsx')
    const selector = read('./OperatorSelectorBase.tsx')
    expect(picker).toContain('includeInternalId={false}')
    expect(selector).toContain('useOperatorAppearanceAvatar(operator)')
  })

  it('keeps Standard reserved operators and alters visible with disabled reasons', () => {
    const standard = read('./SquadConstraintEditorBase.tsx')
    const selector = read('./OperatorSelector.tsx')
    expect(standard).toContain('disabled: reservedIdentity')
    expect(selector).toContain('Alter in squad')
    expect(selector).toContain('Already in squad')
  })

  it('applies alter exclusivity within the Garrison stage', () => {
    const app = read('./App.tsx')
    const editor = read('./GarrisonStageEditor.tsx')
    expect(app).toContain('alterExclusivity={constraints.alterExclusivity}')
    expect(editor).toContain('reservedAlterGroups')
    expect(editor).toContain('alterExclusivity && operator.alterGroup')
    expect(editor).toContain('Alter in squad')
  })

  it('confirms unresolved conflicts without silently cleaning them or disabling duplicates', () => {
    const dialog = read('./GarrisonConflictDialog.tsx')
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(dialog).toContain('window.confirm(')
    expect(dialog).toContain('conflicts.length > 0')
    expect(dialog).toContain('onApply(cloneGarrison(garrison))')
    expect(feature).toContain('duplicateOperatorsAllowed: stillConflicted')
  })

  it('offers individual red-hover icon removals and clear/remove-all stage actions', () => {
    const dialog = read('./GarrisonConflictDialog.tsx')
    const style = read('./GarrisonSquadFeature.css')
    expect(dialog).toContain('Remove All')
    expect(dialog).toContain('Clear')
    expect(dialog).toContain('garrison-conflict-summary-operator')
    expect(dialog).toContain(
      'aria-label={`Remove ${operator?.name ?? operatorId} from ${stage.name}`}',
    )
    expect(style).toContain('garrison-conflict-operator:hover .garrison-conflict-avatar')
  })

  it('places each stage editor immediately after its row and uses the shorter Garrison label', () => {
    const app = read('./App.tsx')
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(app).toContain("['garrison', 'Garrison']")
    expect(feature).toContain('<span>Allow duplicates</span>')
    expect(feature).toContain(
      "stageEditor?.mode === 'existing' && stageEditor.stage.id === stage.id",
    )
    expect(feature).toContain('garrison-stage-editor-inline')
  })
})
