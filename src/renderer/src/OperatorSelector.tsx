import { useEffect, useMemo, useState } from 'react'
import type { Operator } from '../../shared/operator'
import './OperatorSelector.css'

export interface OperatorSelectorOption {
  key: string
  label: string
  operator: Operator
  aliases?: readonly string[]
  disabled?: boolean
  disabledReason?: string
}

function OperatorAvatar({ operator }: { operator: Operator }): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop
      .getOperatorImage(operator.id)
      .then((url) => {
        if (active) setImageUrl(url)
      })
      .catch(() => {
        if (active) setImageUrl(null)
      })
    return () => {
      active = false
    }
  }, [operator.id])

  return imageUrl ? (
    <img className="operator-selector-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span
      className="operator-selector-avatar operator-selector-avatar--fallback"
      aria-hidden="true"
    >
      {operator.name.slice(0, 1)}
    </span>
  )
}

export default function OperatorSelector({
  options,
  valueKey,
  onSelect,
  placeholder = 'Search operators…',
}: {
  options: readonly OperatorSelectorOption[]
  valueKey: string | null
  onSelect: (option: OperatorSelectorOption | null) => void
  placeholder?: string
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const selected = options.find((option) => option.key === valueKey) ?? null
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const matches = query
      ? options.filter((option) =>
          [option.label, option.operator.name, option.operator.id, ...(option.aliases ?? [])].some(
            (value) => value.toLocaleLowerCase().includes(query),
          ),
        )
      : options
    return matches.slice(0, 60)
  }, [options, search])

  return (
    <div className="operator-selector">
      {selected && (
        <div className="operator-selector-selected" data-rarity={selected.operator.rarity}>
          <OperatorAvatar operator={selected.operator} />
          <span>
            <strong>{selected.label}</strong>
            <small>
              {selected.operator.rarity}★ · {selected.operator.class}
            </small>
          </span>
          <button type="button" className="text-button" onClick={() => onSelect(null)}>
            Clear
          </button>
        </div>
      )}
      <label className="operator-selector-search">
        <span className="sr-only">Search operators</span>
        <input
          type="search"
          value={search}
          placeholder={placeholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="operator-selector-results" role="listbox" aria-label="Eligible operators">
        {visible.map((option) => (
          <button
            key={option.key}
            type="button"
            role="option"
            aria-selected={option.key === valueKey}
            disabled={option.disabled}
            className={`operator-selector-option${option.key === valueKey ? ' is-selected' : ''}`}
            title={option.disabled ? option.disabledReason : option.label}
            onClick={() => onSelect(option)}
            data-rarity={option.operator.rarity}
          >
            <OperatorAvatar operator={option.operator} />
            <span>
              <strong>{option.label}</strong>
              <small>
                {option.operator.rarity}★ · {option.operator.class}
              </small>
            </span>
            {option.disabled && <em>{option.disabledReason ?? 'Unavailable'}</em>}
          </button>
        ))}
        {visible.length === 0 && (
          <p className="operator-selector-empty">No eligible operators match this search.</p>
        )}
      </div>
      {options.length > 60 && !search.trim() && (
        <small className="operator-selector-hint">
          Showing the first 60 operators. Search to narrow the eligible pool.
        </small>
      )}
    </div>
  )
}
