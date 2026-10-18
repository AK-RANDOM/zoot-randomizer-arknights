import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison Squad M2', () => {
  it('receives a resolved eligible pool instead of reaching into Curate state', () => {
    const app = read('./App.tsx')
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(app).toContain('eligibleOperators={finalOperatorPool}')
    expect(feature).toContain('eligibleOperators: readonly Operator[]')
    expect(feature).not.toContain('buildFinalOperatorPool')
  })

  it('uses the exact Draft Current Squad geometry with slot 13 as an ordinary slot', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    const css = read('./GarrisonSquadFeature.css')
    const draftGrid = read('./DraftSquadGrid.tsx')
    expect(editor).toContain(
      "import { DraftEmptySlotFrame, DraftRosterAvatar } from './DraftSquadGrid'",
    )
    expect(editor).toContain('const PRIMARY_SLOT_COUNT = GARRISON_STAGE_CAPACITY - 1')
    expect(editor).toContain('{rosterSlot(PRIMARY_SLOT_COUNT)}')
    expect(editor).not.toContain('Current Squad')
    expect(editor).not.toContain('ordinary slots · no Overflow')
    expect(editor).not.toContain('Stage Squad')
    expect(editor).toContain('className="draft-selected-squad"')
    expect(editor).toContain('draft-squad-layout draft-squad-layout--with-capacity')
    expect(css).not.toContain('.garrison-stage-editor-roster .draft-squad-layout--with-capacity')
    expect(draftGrid).toContain('export function DraftEmptySlotFrame')
    expect(draftGrid).toContain('export function DraftRosterAvatar')
  })

  it('wires the stage name into the Draft roster heading position', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('className="garrison-stage-editor-title"')
    expect(editor).toContain('aria-label="Stage name"')
    expect(editor).toContain('onChange={(name) => onChange({ ...stage, name })}')
  })

  it('matches Standard Squad centered stacked Modify/Clear presentation', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('standard-slot-action-card')
    expect(editor).toContain('className="standard-slot-actions-overlay"')
    expect(editor).toContain('className="draft-operator-actions"')
    expect(editor).toContain("operatorId ? 'Modify' : 'Add'")
    expect(editor).toContain('Clear')
  })

  it('makes every slot clickable while normalizing additions into the dense stage squad', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('role="button"')
    expect(editor).toContain('tabIndex={0}')
    expect(editor).toContain('onClick={() => openSlot(slotIndex)}')
    expect(editor).not.toContain('isNextOpenSlot')
    expect(editor).toContain('else next.push(operatorId)')
    expect(editor).toContain('normalizeGarrisonStageOperatorIds(next)')
  })

  it('uses a search-only Standard slot-editor shell', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('className="slot-editor-backdrop"')
    expect(editor).toContain('className="slot-editor garrison-operator-picker"')
    expect(editor).toContain('<OperatorSelector')
    expect(editor).not.toContain('OperatorMultiSelector')
    expect(editor).toContain('placeholder="Search eligible operators…"')
  })

  it('keeps stage edits transactional and provides one-step undo/redo', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain("mode: 'new' | 'existing'")
    expect(feature).toContain('undo: GarrisonStage | null')
    expect(feature).toContain('redo: GarrisonStage | null')
    expect(feature).toContain('const [undoWorking, setUndoWorking]')
    expect(feature).toContain('const [redoWorking, setRedoWorking]')
    expect(feature).toContain('Undo')
    expect(feature).toContain('Redo')
    expect(feature).toContain('Canceled new stage; no stage was added.')
    expect(feature).toContain('Save Garrison to keep the change.')
  })

  it('renders stage table squads as a single row of Draft History-style icons', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const css = read('./GarrisonSquadFeature.css')
    expect(feature).toContain('GarrisonStageOperatorIcon')
    expect(feature).toContain('release-representative draft-history__operator-icon')
    expect(feature).toContain('className="garrison-stage-squad-icons"')
    expect(css).toContain('flex-wrap: nowrap')
  })

  it('exposes Allow duplicates and resolves conflicts on stage Confirm', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const dialog = read('./GarrisonConflictDialog.tsx')
    expect(feature).toContain('Allow duplicates')
    expect(feature).toContain('changeDuplicatePolicy(event.target.checked)')
    expect(feature).toContain('garrisonHasOperatorConflicts(next)')
    expect(feature).toContain('before confirming this stage')
    expect(feature).not.toContain('before saving this Garrison')
    expect(dialog).toContain('Conflict detected')
    expect(dialog).toContain('Remove All')
    expect(dialog).toContain('Clear')
    expect(dialog).toContain('Apply Changes')
  })

  it('places Confirm and Cancel in the Draft capacity-control column', () => {
    const editor = read('./GarrisonStageEditor.tsx')
    expect(editor).toContain('draft-squad-capacity-column garrison-stage-editor-side')
    expect(editor).toContain('garrison-stage-editor-actions')
    expect(editor).toContain('Cancel')
    expect(editor).toContain('Confirm Stage')
  })
})
