import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Operator } from '../../shared/operator'
import GarrisonEventHelperAvatar from './GarrisonEventHelperAvatar'
import './ReleaseDateDropdown.css'

export interface EventSelectorOption {
  id: string
  name: string
  representative: Operator | null
  group?: string
}

export default function EventSelectorDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'No events available',
  disabled = false,
  groups,
  showLabel = true,
}: {
  label: string
  options: EventSelectorOption[]
  value: string
  onChange: (id: string) => boolean
  placeholder?: string
  disabled?: boolean
  groups?: readonly string[]
  showLabel?: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLDetailsElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  useLayoutEffect(() => {
    const list = listRef.current
    const activeOption = list?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (list && activeOption) {
      list.scrollTop = activeOption.offsetTop - (list.clientHeight - activeOption.offsetHeight) / 2
    }
  }, [open, disabled, value])
  useEffect(() => {
    const close = (event: Event): void => {
      if (event.target instanceof Node && ref.current && !ref.current.contains(event.target))
        ref.current.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('focusin', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('focusin', close)
    }
  }, [])
  const row = (option: EventSelectorOption): React.JSX.Element => (
    <>
      <GarrisonEventHelperAvatar operator={option.representative} />
      <span>{option.name}</span>
    </>
  )
  const choice = (option: EventSelectorOption): React.JSX.Element => (
    <button
      key={option.id}
      type="button"
      aria-pressed={option.id === value}
      onClick={() => {
        if (onChange(option.id) && ref.current) {
          ref.current.open = false
          ref.current.querySelector('summary')?.focus()
        }
      }}
    >
      {row(option)}
    </button>
  )
  return (
    <div className="field release-date-field">
      {showLabel && <span>{label}</span>}
      <details
        ref={ref}
        className="release-date-dropdown"
        onToggle={(event) => {
          if (disabled) event.currentTarget.open = false
          setOpen(event.currentTarget.open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && ref.current) {
            ref.current.open = false
            ref.current.querySelector('summary')?.focus()
          }
        }}
      >
        <summary
          aria-label={`${label}: ${selected?.name ?? placeholder}`}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault()
          }}
        >
          {selected ? row(selected) : <span>{placeholder}</span>}
          <span className="release-date-chevron" aria-hidden="true">
            ▾
          </span>
        </summary>
        {open && !disabled && (
          <div ref={listRef} className="release-date-options" role="group" aria-label={label}>
            {groups
              ? groups.map((group) => (
                  <div key={group} role="group" aria-label={group}>
                    <strong className="event-selector-group-title">{group}</strong>
                    {options.filter((option) => option.group === group).map(choice)}
                  </div>
                ))
              : options.map(choice)}
            {!options.length && <p>{placeholder}</p>}
          </div>
        )}
      </details>
    </div>
  )
}
