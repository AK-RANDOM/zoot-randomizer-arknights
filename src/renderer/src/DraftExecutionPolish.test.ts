import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { draftConfirmationCopy } from './draftConfirmation'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Draft execution polish', () => {
  it('adds semantic spacing before Hold and Forfeit', () => {
    const css = read('./DraftDecisionPlane.css')
    expect(css).toContain('.draft-decision-side-rail {')
    expect(css).toContain('margin-left: 8px;')
  })

  it('places Release inside the Held operator overlay below Pick', () => {
    const card = read('./DraftOperatorCard.tsx')
    const plane = read('./DraftDecisionPlane.tsx')
    expect(card).toContain('releasePresentation && onRelease')
    expect(card).toContain('draft-operator-action--release')
    expect(plane).toContain('releasePresentation={releaseHold}')
    expect(plane).toContain(
      'onRelease={releaseHold ? () => onAction(releaseHold.action) : undefined}',
    )
    expect(plane).not.toContain('<strong>Release</strong>')
  })

  it('uses a compact pill identity on Current Draft avatars', () => {
    const css = read('./DraftSquadGrid.css')
    expect(css).toContain('border-radius: 999px;')
    expect(css).toContain('font-size: 0.68rem;')
    expect(css).toContain('width: 1em;')
    expect(css).toContain('height: 1em;')
    expect(css).toContain('padding: 0;')
    expect(css).toContain('background: transparent;')
    expect(css).toContain('background: rgba(7, 7, 9, 0.72);')
  })

  it('replaces Abandon with same-size Finalize and completes the active session', () => {
    const view = read('./DraftSessionView.tsx')
    const session = read('./useDraftSession.ts')
    expect(view).toContain('className="randomize-button draft-status-new"')
    expect(view).toContain("draftOngoing ? 'Finalize' : 'Start Draft'")
    expect(view).not.toContain('Abandon')
    expect(session).toContain("completionReason: 'finalized'")
    expect(session).toContain("status: 'complete'")
    expect(draftConfirmationCopy({ type: 'finalize-draft' }).confirmLabel).toBe('Finalize')
  })

  it('shows Draft History only after completion and keeps locked frames at one 3px layer', () => {
    const view = read('./DraftSessionView.tsx')
    const lockedCss = read('./LockedSlotCard.css')
    const themeCss = read('./RendererTheme.css')

    expect(view).toContain("state?.status === 'complete'")
    expect(view).toContain('<DraftHistoryTable state={state} operatorById={operatorById} />')
    expect(lockedCss).toContain('padding: 0;')
    expect(themeCss).toContain('.squad-grid .slot-locked-card .operator-card--portrait {')
    expect(themeCss).toContain('border: 0;')
  })

  it('removes verbose Rulebook/session detail from the execution view', () => {
    const view = read('./DraftSessionView.tsx')
    expect(view).not.toContain('draft-rulebook-description')
    expect(view).not.toContain('draft-session-note')
    expect(view).not.toContain('This Draft is tied to its starting pool')
    expect(view).not.toContain('Draft Rulebook context')
  })

  it('polishes the finalized Draft summary and history presentation', () => {
    const view = read('./DraftSessionView.tsx')
    const grid = read('./DraftSquadGrid.tsx')
    const panelCss = read('./DraftPanel.css')

    expect(view).not.toContain('draftCompletionMessage')
    expect(view).not.toContain('className="draft-complete"')
    expect(view).toContain('release-representative draft-history__operator-icon')
    expect(view).toContain('draft-history__entry draft-history__entry--action')
    expect(grid).toContain("finalized ? 'Finalized Draft' : 'Current Draft'")
    expect(panelCss).toContain('margin: 28px 0 20px;')
    expect(panelCss).toContain('justify-content: flex-end;')
    expect(panelCss).toContain('text-align: right;')
  })

  it('simplifies Draft capacity cards and fixes the open-slot artwork path', () => {
    const grid = read('./DraftSquadGrid.tsx')
    const css = read('./DraftSquadGrid.css')

    expect(grid).toContain('open-slot-icon.png')
    expect(grid).toContain("variant === 'valid' ? openSlotIconUrl : lockedSlotIconUrl")
    expect(grid).toContain('event.currentTarget.src = overflowSlotIconUrl')
    expect(grid).toContain('<strong>Overflow</strong>')
    expect(grid).not.toContain('<strong>Empty</strong>')
    expect(grid).not.toContain('Temporary slot')
    expect(grid).not.toContain('<strong>Expand</strong>')
    expect(grid).toContain('aria-label={`Expand capacity, ${economyLabel}`}')
    expect(css).toContain('font-size: 2.8rem;')
  })

  it('keeps Draft target size independent from Standard squad constraints', () => {
    const app = read('./App.tsx')
    expect(app).toContain('const DEFAULT_DRAFT_TARGET_SIZE = 12')
    expect(app).toContain('targetSize={DEFAULT_DRAFT_TARGET_SIZE}')
    expect(app).not.toContain('targetSize={constraints.squadSize}')
  })
})
