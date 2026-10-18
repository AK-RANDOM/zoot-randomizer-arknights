import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison Squad M5 persistence and polish', () => {
  it('keeps saved Garrisons in the renderer persistence envelope with structural normalization', () => {
    const persistence = read('./rendererPersistence.ts')
    expect(persistence).toContain('cloneGarrison')
    expect(persistence).toContain('loadSavedGarrisons')
    expect(persistence).toContain('saveSavedGarrisons')
    expect(persistence).toMatch(/normalize(?:Saved)?Garrisons/)
    expect(persistence).toContain('duplicateOperatorsAllowed')
  })

  it('confirms deletion before removing a populated stage', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('stage.operatorIds.length > 0')
    expect(feature).toContain(
      'Delete stage “${stage.name}” and its ${stage.operatorIds.length} assigned operator',
    )
    expect(feature).toContain('Deleted stage “${stage.name}” from the working Garrison')
  })

  it('keeps historical assignments renderable even when they are outside the current eligible pool', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('const operatorById = useMemo')
    expect(feature).toContain('new Map(operators.map')
    expect(feature).toContain('eligibleOperators={eligibleOperators}')
    expect(feature).toContain('operatorById.get(operatorId)')
  })

  it('keeps stage confirmation explicit and separate from top-level Save Garrison', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('Confirm Stage')
    expect(editor).toContain('Cancel')
    expect(feature).toContain('Save Garrison to keep the change.')
    expect(feature).toContain('Save Garrison')
  })

  it('preserves Garrison as a non-randomized mode and reuses existing Draft/Standard surfaces', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const editor = read('./GarrisonStageEditor.tsx')
    expect(feature).not.toContain('generateSquad')
    expect(feature).not.toContain('useDraftSession')
    expect(editor).toContain('DraftEmptySlotFrame')
    expect(editor).toContain('DraftRosterAvatar')
    expect(editor).toContain('<OperatorSelector')
  })

  it('contains responsive and long-name polish for dense Garrison documents', () => {
    const css = read('./GarrisonSquadFeature.css')
    expect(css).toContain('text-overflow: ellipsis')
    expect(css).toContain('@media (max-width: 820px)')
    expect(css).toContain('overflow-x: auto')
    expect(css).toContain('.garrison-conflict-summary-row')
  })
})
