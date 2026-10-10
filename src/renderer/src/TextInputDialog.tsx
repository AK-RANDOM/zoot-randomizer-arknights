import { useEffect, useRef, useState } from 'react'

export default function TextInputDialog({
  title,
  initialValue = '',
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  initialValue?: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (value: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="confirmation-dialog preset-name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-name-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="preset-name-dialog-title">{title}</h3>
        <input
          ref={inputRef}
          className="preset-name-dialog-input"
          value={value}
          aria-label="Preset name"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onCancel()
          }}
        />
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="randomize-button" disabled={!value.trim()} onClick={submit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
