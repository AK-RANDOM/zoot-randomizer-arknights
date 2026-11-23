import { describe, expect, it } from 'vitest'
import { normalizeDraftConfirmationMode, shouldConfirmDraftAction } from './draftConfirmationPolicy'

describe('Draft confirmation frequency', () => {
  it('migrates the old on/off setting and preserves all four modes', () => {
    expect(normalizeDraftConfirmationMode(undefined, true)).toBe('action')
    expect(normalizeDraftConfirmationMode(undefined, false)).toBe('never')
    for (const mode of ['action', 'run', 'session', 'never'] as const) {
      expect(normalizeDraftConfirmationMode(mode, false)).toBe(mode)
    }
  })

  it('confirms every action regardless of previous confirmations', () => {
    expect(shouldConfirmDraftAction('action', true, true)).toBe(true)
  })

  it('asks again for a new run, even when this app session was confirmed', () => {
    expect(shouldConfirmDraftAction('run', false, true)).toBe(true)
    expect(shouldConfirmDraftAction('run', true, false)).toBe(false)
  })

  it('keeps the app session confirmed across new runs', () => {
    expect(shouldConfirmDraftAction('session', false, true)).toBe(false)
    expect(shouldConfirmDraftAction('session', true, false)).toBe(true)
  })

  it('never asks when disabled', () => {
    expect(shouldConfirmDraftAction('never', false, false)).toBe(false)
  })
})
