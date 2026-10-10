import { useEffect } from 'react'
import type { DraftConfirmationCopy } from './draftConfirmation'
import './DraftConfirmationDialog.css'

interface DraftConfirmationDialogProps {
  copy: DraftConfirmationCopy
  suppressSession: boolean
  onSuppressSessionChange: (value: boolean) => void
  allowSuppression?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function DraftConfirmationDialog({
  copy,
  suppressSession,
  onSuppressSessionChange,
  allowSuppression = true,
  onCancel,
  onConfirm,
}: DraftConfirmationDialogProps): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="draft-confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="draft-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-confirmation-title"
        aria-describedby="draft-confirmation-body"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="draft-confirmation-title">{copy.title}</h3>
        <p id="draft-confirmation-body">{copy.body}</p>
        {allowSuppression && (
          <label className="draft-confirmation-suppress">
            <input
              type="checkbox"
              checked={suppressSession}
              onChange={(event) => onSuppressSessionChange(event.target.checked)}
            />
            <span>{copy.suppressionLabel}</span>
          </label>
        )}
        <div className="draft-confirmation-actions">
          <button type="button" className="secondary-button" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="randomize-button" onClick={onConfirm}>
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
