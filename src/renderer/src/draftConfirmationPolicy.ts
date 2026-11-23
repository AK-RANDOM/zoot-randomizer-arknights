export type DraftConfirmationMode = 'action' | 'run' | 'session' | 'never'

export function normalizeDraftConfirmationMode(
  value: unknown,
  legacyEnabled = true,
): DraftConfirmationMode {
  return value === 'action' || value === 'run' || value === 'session' || value === 'never'
    ? value
    : legacyEnabled
      ? 'action'
      : 'never'
}

export function shouldConfirmDraftAction(
  mode: DraftConfirmationMode,
  runConfirmed: boolean,
  appConfirmed: boolean,
): boolean {
  return (
    mode === 'action' || (mode === 'run' && !runConfirmed) || (mode === 'session' && !appConfirmed)
  )
}

let appSessionConfirmed = false

export function hasConfirmedDraftAppSession(): boolean {
  return appSessionConfirmed
}

export function markDraftAppSessionConfirmed(): void {
  appSessionConfirmed = true
}
