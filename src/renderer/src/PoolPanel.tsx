import { useEffect, useMemo, useState } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import type { Operator, OperatorDataset } from '../../shared/operator'
import {
  applyManualOperatorExclusions,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
  type OperatorPreferences,
} from '../../shared/operatorPool'
import { filterHigherLevelEligibleOperators } from '../../shared/randomizer'
import './PoolPanel.css'

type PoolStateFilter = 'all' | 'included' | 'excluded'
type PoolGroupBy = 'none' | 'class' | 'rarity' | 'releaseYear' | 'mainFaction' | 'acquisition'

function PoolAvatar({ operator }: { operator: Operator }): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorImage(operator.id).then((url) => {
      if (active) setImageUrl(url)
    })
    return () => {
      active = false
    }
  }, [operator.id])

  return imageUrl ? (
    <img className="pool-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-avatar pool-avatar--fallback" aria-hidden="true">
      {operator.name.slice(0, 1)}
    </span>
  )
}

function acquisitionLabel(operator: Operator): string {
  switch (operator.acquisition.family) {
    case 'limited':
      return 'Limited'
    case 'standard':
      return 'Standard'
    case 'welfare':
      return 'Welfare'
  }
}

function mainFactionLabel(operator: Operator, dataset: OperatorDataset): string {
  return operator.faction.main
    ? dataset.factionLabels[operator.faction.main] ?? operator.faction.main
    : 'Unaffiliated'
}

function groupLabel(
  operator: Operator,
  groupBy: PoolGroupBy,
  dataset: OperatorDataset,
  constraints: RandomizerConstraints,
): string {
  switch (groupBy) {
    case 'class':
      return operator.class
    case 'rarity':
      return `${operator.rarity}★`
    case 'releaseYear': {
      const year = operator.release[constraints.release.server].yearGroup
      return year === null ? 'Unknown release year' : `Year ${year}`
    }
    case 'mainFaction':
      return mainFactionLabel(operator, dataset)
    case 'acquisition':
      return acquisitionLabel(operator)
    case 'none':
      return 'All operators'
  }
}

function OperatorEntry({
  operator,
  factionLabel,
  included,
  presentation,
  onToggle,
}: {
  operator: Operator
  factionLabel: string
  included: boolean
  presentation: OperatorPreferences['poolPresentation']
  onToggle: () => void
}): React.JSX.Element {
  const stateLabel = included ? 'Included' : 'Excluded'
  const commonProps = {
    type: 'button' as const,
    'aria-pressed': included,
    'aria-label': `${operator.name}, ${stateLabel}`,
    title: `${operator.name} — ${stateLabel}`,
    onClick: onToggle,
  }

  if (presentation === 'imageGrid') {
    return (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--image${included ? '' : ' is-excluded'}`}
      >
        <PoolAvatar operator={operator} />
        <span className="pool-entry-state" aria-hidden="true">
          {included ? '✓' : '×'}
        </span>
      </button>
    )
  }

  if (presentation === 'compactCard') {
    return (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--compact${included ? '' : ' is-excluded'}`}
      >
        <PoolAvatar operator={operator} />
        <span className="pool-entry-copy">
          <strong>{operator.name}</strong>
          <small>{operator.rarity}★ · {operator.class} · {operator.subclass.name}</small>
        </span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }

  if (presentation === 'simpleList') {
    return (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--list${included ? '' : ' is-excluded'}`}
      >
        <PoolAvatar operator={operator} />
        <strong>{operator.name}</strong>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }

  return (
    <button
      {...commonProps}
      className={`pool-entry pool-entry--detailed${included ? '' : ' is-excluded'}`}
    >
      <PoolAvatar operator={operator} />
      <span className="pool-entry-copy">
        <strong>{operator.name}</strong>
        <small>{operator.rarity}★ · {operator.class} · {operator.subclass.name}</small>
        <small>Main faction: {factionLabel}</small>
      </span>
      <span className="pool-entry-status">{stateLabel}</span>
    </button>
  )
}

export default function PoolPanel({
  dataset,
  constraints,
  preferences,
  onPreferencesChange,
}: {
  dataset: OperatorDataset
  constraints: RandomizerConstraints
  preferences: OperatorPreferences
  onPreferencesChange: (next: OperatorPreferences) => void
}): React.JSX.Element {
  const [stateFilter, setStateFilter] = useState<PoolStateFilter>('all')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<PoolGroupBy>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const higherLevelEligible = useMemo(
    () => filterHigherLevelEligibleOperators(dataset.operators, constraints),
    [constraints, dataset],
  )
  const excludedIds = useMemo(
    () => new Set(preferences.excludedOperatorIds),
    [preferences.excludedOperatorIds],
  )
  const finalPool = useMemo(
    () => applyManualOperatorExclusions(higherLevelEligible, preferences.excludedOperatorIds),
    [higherLevelEligible, preferences.excludedOperatorIds],
  )

  const displayed = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return higherLevelEligible.filter((operator) => {
      const excluded = excludedIds.has(operator.id)
      if (stateFilter === 'included' && excluded) return false
      if (stateFilter === 'excluded' && !excluded) return false
      if (query && !operator.name.toLocaleLowerCase().includes(query)) return false
      return true
    })
  }, [excludedIds, higherLevelEligible, search, stateFilter])

  const groups = useMemo(() => {
    const map = new Map<string, Operator[]>()
    for (const operator of displayed) {
      const label = groupLabel(operator, groupBy, dataset, constraints)
      const values = map.get(label) ?? []
      values.push(operator)
      map.set(label, values)
    }
    return [...map.entries()].sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
  }, [constraints, dataset, displayed, groupBy])

  const setDisplayedExcluded = (excluded: boolean): void => {
    onPreferencesChange({
      ...preferences,
      excludedOperatorIds: setDisplayedOperatorsExcluded(
        preferences.excludedOperatorIds,
        displayed.map((operator) => operator.id),
        excluded,
      ),
    })
  }

  const toggleOperator = (operator: Operator): void => {
    onPreferencesChange({
      ...preferences,
      excludedOperatorIds: setOperatorExcluded(
        preferences.excludedOperatorIds,
        operator.id,
        !excludedIds.has(operator.id),
      ),
    })
  }

  return (
    <section className="panel pool-panel" aria-labelledby="pool-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">POOL</p>
          <h2 id="pool-heading">Individual operators</h2>
        </div>
        <div className="section-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={displayed.length === 0}
            onClick={() => setDisplayedExcluded(false)}
          >
            Add displayed to pool
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={displayed.length === 0}
            onClick={() => setDisplayedExcluded(true)}
          >
            Remove displayed from pool
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={preferences.excludedOperatorIds.length === 0}
            onClick={() =>
              onPreferencesChange({ ...preferences, excludedOperatorIds: [] })
            }
          >
            Reset individual exclusions
          </button>
        </div>
      </div>

      <div className="pool-toolbar">
        <label className="field pool-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Search operators…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Pool state</span>
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as PoolStateFilter)}
          >
            <option value="all">All</option>
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
        <label className="field">
          <span>Group by</span>
          <select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as PoolGroupBy)
              setCollapsedGroups(new Set())
            }}
          >
            <option value="none">None</option>
            <option value="class">Class</option>
            <option value="rarity">Rarity</option>
            <option value="releaseYear">Release Year</option>
            <option value="mainFaction">Main Faction</option>
            <option value="acquisition">Acquisition</option>
          </select>
        </label>
      </div>

      <div className="pool-information" role="status">
        <strong>{finalPool.length} operators eligible</strong>
        <span>· {displayed.length} displayed</span>
        <span>· {higherLevelEligible.length} pass higher-level filters</span>
      </div>

      <div className={`pool-groups pool-presentation--${preferences.poolPresentation}`}>
        {groups.map(([label, operators]) => {
          const collapsed = collapsedGroups.has(label)
          return (
            <section className="pool-group" key={label}>
              {groupBy !== 'none' && (
                <button
                  type="button"
                  className="pool-group-heading"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedGroups((current) => {
                      const next = new Set(current)
                      if (next.has(label)) next.delete(label)
                      else next.add(label)
                      return next
                    })
                  }
                >
                  <span>{collapsed ? '▸' : '▾'} {label}</span>
                  <span>{operators.length}</span>
                </button>
              )}
              {!collapsed && (
                <div className="pool-entries">
                  {operators.map((operator) => (
                    <OperatorEntry
                      key={operator.id}
                      operator={operator}
                      factionLabel={mainFactionLabel(operator, dataset)}
                      included={!excludedIds.has(operator.id)}
                      presentation={preferences.poolPresentation}
                      onToggle={() => toggleOperator(operator)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
        {displayed.length === 0 && (
          <div className="pool-empty">No operators match the current Pool view.</div>
        )}
      </div>
    </section>
  )
}
