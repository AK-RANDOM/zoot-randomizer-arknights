import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison Squad M4 cross-stage duplicate policy', () => {
  it('keeps the duplicate toggle transactional when existing conflicts are present', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain(
      "type ConflictPurpose = 'stage-confirm' | 'disable-cross-stage-duplicates'",
    )
    expect(feature).toContain('const changeDuplicatePolicy = (allowDuplicates: boolean)')
    expect(feature).toContain("setConflictPurpose('disable-cross-stage-duplicates')")
    expect(feature).toContain('Resolve them before duplicate prevention can become active')
    expect(feature).toContain('Duplicate prevention was not enabled')
    expect(feature).toContain('cross-stage duplicate prevention enabled')
  })

  it('blocks operators used by other stages at selection time instead of hiding them', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const editor = read('./GarrisonStageEditor.tsx')
    expect(feature).toContain('otherStages={working.stages.filter')
    expect(feature).toContain('duplicateOperatorsAllowed={working.duplicateOperatorsAllowed}')
    expect(editor).toContain('crossStageAssignments')
    expect(editor).toContain('disabled: conflictingStages.length > 0')
    expect(editor).toContain('Already assigned to')
    expect(editor).toContain('remain visible but unavailable')
    expect(editor).toContain('if (!option || option.disabled) return')
  })

  it('excludes the currently edited stage from cross-stage conflict lookup', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('working.stages.filter((stage) => stage.id !== stageEditor.stage.id)')
  })

  it('retains same-stage duplicate prevention independently of cross-stage policy', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('reservedInStage')
    expect(editor).toContain('.filter((operator) => !reservedInStage.has(operator.id))')
    expect(editor).toContain('normalizeGarrisonStageOperatorIds(next)')
  })

  it('shows each conflicting operator and the affected stage names before resolving', () => {
    const dialog = read('./GarrisonConflictDialog.tsx')
    expect(dialog).toContain('getGarrisonOperatorConflicts')
    expect(dialog).toContain('Conflicting operators and stages')
    expect(dialog).toContain("conflict.stageNames.join(' · ')")
    expect(dialog).toContain('Remove Conflicting Operator')
    expect(dialog).toContain('Clear Squad')
    expect(dialog).toContain('Clear Conflict')
  })
})
