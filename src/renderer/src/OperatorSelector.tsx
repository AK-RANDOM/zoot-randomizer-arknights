import { useEffect, useMemo, useState } from 'react'
import type { Operator, OperatorClass } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import './OperatorSelector.css'

export interface OperatorSelectorOption {
  key: string
  label: string
  operator: Operator
  aliases?: readonly string[]
  classIcons?: readonly OperatorClass[]
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

function optionClasses(option: OperatorSelectorOption): readonly OperatorClass[] {
  return option.classIcons?.length ? option.classIcons : [option.operator.class]
}

function OperatorClassStack({ option }: { option: OperatorSelectorOption }): React.JSX.Element {
  const classes = optionClasses(option)
  return (
    <span
      className={`operator-selector-class-stack${classes.length > 1 ? ' is-multiple' : ''}`}
      aria-label={classes.join(', ')}
    >
      {classes.map((operatorClass) => (
        <ClassIcon key={operatorClass} operatorClass={operatorClass} />
      ))}
    </span>
  )
}

function optionMeta(option: OperatorSelectorOption): string {
  return `${option.operator.rarity}★ · ${optionClasses(option).join(' / ')}`
}

export function filterOperatorSelectorOptions(
  options: readonly OperatorSelectorOption[],
  search: string,
  limit = 60,
): OperatorSelectorOption[] {
  const query = search.trim().toLocaleLowerCase()
  const matches = query
    ? options.filter((option) =>
        [option.label, option.operator.name, option.operator.id, ...(option.aliases ?? [])].some(
          (value) => value.toLocaleLowerCase().includes(query),
        ),
      )
    : options
  return matches.slice(0, limit)
}

export default function OperatorSelector({
  options,
  valueKey,
  onSelect,
  placeholder = 'Search operators…',
  disabled = false,
}: {
  options: readonly OperatorSelectorOption[]
  valueKey: string | null
  onSelect: (option: OperatorSelectorOption | null) => void
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const selected = options.find((option) => option.key === valueKey) ?? null
  const hasSearch = search.trim().length > 0
  const visible = useMemo(
    () => (hasSearch ? filterOperatorSelectorOptions(options, search) : []),
    [hasSearch, options, search],
  )

  return (
    <div className="operator-selector">
      <label className="operator-selector-search">
        <span className="sr-only">Search operators</span>
        <input
          type="search"
          value={search}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {selected && (
        <div className="operator-selector-selected" data-rarity={selected.operator.rarity}>
          <OperatorAvatar operator={selected.operator} />
          <span className="operator-selector-copy">
            <strong>{selected.label}</strong>
            <small>{optionMeta(selected)}</small>
          </span>
          <OperatorClassStack option={selected} />
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => onSelect(null)}
          >
            Clear
          </button>
        </div>
      )}
      {hasSearch && (
        <div className="operator-selector-results" role="listbox" aria-label="Eligible operators">
          {visible.map((option) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={option.key === valueKey}
              disabled={disabled || option.disabled}
              className={`operator-selector-option${option.key === valueKey ? ' is-selected' : ''}`}
              title={option.disabled ? option.disabledReason : option.label}
              onClick={() => onSelect(option)}
              data-rarity={option.operator.rarity}
            >
              <OperatorAvatar operator={option.operator} />
              <span className="operator-selector-copy">
                <strong>{option.label}</strong>
                <small>{optionMeta(option)}</small>
              </span>
              <OperatorClassStack option={option} />
              {option.disabled && <em>{option.disabledReason ?? 'Unavailable'}</em>}
            </button>
          ))}
          {visible.length === 0 && (
            <p className="operator-selector-empty">No eligible operators match this search.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function OperatorMultiSelector({
  options,
  valueKeys,
  onChange,
  placeholder = 'Search operators…',
  disabled = false,
}: {
  options: readonly OperatorSelectorOption[]
  valueKeys: readonly string[]
  onChange: (valueKeys: string[]) => void
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const optionByKey = useMemo(
    () => new Map(options.map((option) => [option.key, option])),
    [options],
  )
  const selectedKeys = useMemo(() => new Set(valueKeys), [valueKeys])
  const selected = useMemo(
    () =>
      valueKeys
        .map((key) => optionByKey.get(key))
        .filter((option): option is OperatorSelectorOption => option !== undefined),
    [optionByKey, valueKeys],
  )
  const unresolved = useMemo(
    () => valueKeys.filter((key) => !optionByKey.has(key)),
    [optionByKey, valueKeys],
  )
  const hasSearch = search.trim().length > 0
  const visible = useMemo(
    () => (hasSearch ? filterOperatorSelectorOptions(options, search) : []),
    [hasSearch, options, search],
  )

  const toggle = (key: string): void => {
    if (disabled) return
    if (selectedKeys.has(key)) onChange(valueKeys.filter((current) => current !== key))
    else onChange([...valueKeys, key])
  }

  const remove = (key: string): void => {
    if (disabled) return
    onChange(valueKeys.filter((current) => current !== key))
  }

  return (
    <div className="operator-selector operator-selector--multi">
      <label className="operator-selector-search">
        <span className="sr-only">Search operators</span>
        <input
          type="search"
          value={search}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {(selected.length > 0 || unresolved.length > 0) && (
        <div className="operator-selector-selected-list" aria-label="Selected operators">
          {selected.map((option) => (
            <div
              className="operator-selector-selected"
              data-rarity={option.operator.rarity}
              key={option.key}
            >
              <OperatorAvatar operator={option.operator} />
              <span className="operator-selector-copy">
                <strong>{option.label}</strong>
                <small>{optionMeta(option)}</small>
              </span>
              <OperatorClassStack option={option} />
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={() => remove(option.key)}
              >
                Remove
              </button>
            </div>
          ))}
          {unresolved.map((key) => (
            <div className="operator-selector-unresolved" key={key}>
              <span className="operator-selector-copy">
                <strong>{key}</strong>
                <small>Unresolved operator reference</small>
              </span>
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={() => remove(key)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {hasSearch && (
        <div
          className="operator-selector-results"
          role="listbox"
          aria-label="Available operators"
          aria-multiselectable="true"
        >
          {visible.map((option) => {
            const isSelected = selectedKeys.has(option.key)
            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled || option.disabled}
                className={`operator-selector-option${isSelected ? ' is-selected' : ''}`}
                title={option.disabled ? option.disabledReason : option.label}
                onClick={() => toggle(option.key)}
                data-rarity={option.operator.rarity}
              >
                <OperatorAvatar operator={option.operator} />
                <span className="operator-selector-copy">
                  <strong>{option.label}</strong>
                  <small>{optionMeta(option)}</small>
                </span>
                <OperatorClassStack option={option} />
                <span className="operator-selector-selection-state" aria-hidden="true">
                  {isSelected ? '✓' : '+'}
                </span>
              </button>
            )
          })}
          {visible.length === 0 && (
            <p className="operator-selector-empty">No eligible operators match this search.</p>
          )}
        </div>
      )}
      <small className="operator-selector-hint">
        {valueKeys.length} selected
        {!hasSearch ? ' · Start typing to show operators.' : ''}
      </small>
    </div>
  )
}
