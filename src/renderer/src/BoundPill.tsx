import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_NUMERIC_CONSTRAINT,
  resolveNumericConstraint,
  type NumericConstraint,
} from '../../shared/constraints'

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(12, Math.trunc(value)))
}

interface ActiveBoundPopover {
  token: symbol
  close: () => void
}

let activeBoundPopover: ActiveBoundPopover | null = null

export function formatBoundSummary(value: NumericConstraint | undefined): string {
  const resolved = resolveNumericConstraint(value)
  if (resolved.min === 0 && resolved.max === 12) return 'Any'
  if (resolved.min === resolved.max) return `Exactly ${resolved.min}`
  if (resolved.min === 0) return `≤ ${resolved.max}`
  if (resolved.max === 12) return `≥ ${resolved.min}`
  return `${resolved.min}–${resolved.max}`
}

export default function BoundPill({
  label,
  labelText,
  value,
  disabled = false,
  onSave,
}: {
  label: ReactNode
  labelText?: string
  value: NumericConstraint | undefined
  disabled?: boolean
  onSave: (value: NumericConstraint) => void
}): React.JSX.Element {
  const resolved = resolveNumericConstraint(value)
  const accessibleLabel = labelText ?? (typeof label === 'string' ? label : 'Squad')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<NumericConstraint>({ ...resolved })
  const instanceToken = useRef(Symbol('bound-popover')).current
  const closePopover = useCallback(() => {
    setOpen(false)
    if (activeBoundPopover?.token === instanceToken) activeBoundPopover = null
  }, [instanceToken])

  useEffect(() => {
    if (!open) setDraft({ ...resolved })
  }, [open, resolved.min, resolved.max])

  useEffect(() => () => {
    if (activeBoundPopover?.token === instanceToken) activeBoundPopover = null
  }, [instanceToken])

  const invalid = draft.min > draft.max

  return (
    <div className="bound-control">
      <span className="bound-label">{label}</span>
      <button
        type="button"
        className="bound-pill"
        disabled={disabled}
        aria-label={`${accessibleLabel}: ${formatBoundSummary(value)}`}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            closePopover()
            return
          }
          activeBoundPopover?.close()
          setDraft({ ...resolved })
          setOpen(true)
          activeBoundPopover = { token: instanceToken, close: closePopover }
        }}
      >
        {formatBoundSummary(value)}
      </button>
      {open && !disabled && (
        <div className="bound-popover" role="dialog" aria-label={`${accessibleLabel} squad bound`}>
          <strong>{label}</strong>
          <div className="bound-inputs">
            <label>
              <span>Minimum</span>
              <input
                type="number"
                min={0}
                max={12}
                value={draft.min}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    min: clamp(Number(event.target.value)),
                  }))
                }
              />
            </label>
            <label>
              <span>Maximum</span>
              <input
                type="number"
                min={0}
                max={12}
                value={draft.max}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    max: clamp(Number(event.target.value)),
                  }))
                }
              />
            </label>
          </div>
          {invalid && <span className="bound-error">Minimum cannot exceed maximum.</span>}
          <div className="bound-popover-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft({ ...DEFAULT_NUMERIC_CONSTRAINT })}
            >
              Reset to Any
            </button>
            <span className="bound-popover-spacer" />
            <button type="button" className="secondary-button" onClick={closePopover}>
              Cancel
            </button>
            <button
              type="button"
              className="randomize-button"
              disabled={invalid}
              onClick={() => {
                onSave(draft)
                closePopover()
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
