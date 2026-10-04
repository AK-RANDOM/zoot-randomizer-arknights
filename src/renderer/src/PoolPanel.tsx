import { useEffect, useMemo, useState } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import { operatorClasses, type Operator, type OperatorDataset } from '../../shared/operator'
import {
  applyManualOperatorExclusions,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
  type OperatorPreferences,
} from '../../shared/operatorPool'
import { filterHigherLevelEligibleOperators } from '../../shared/randomizer'
import { releaseGroupLabel } from '../../shared/releaseBounds'
import './PoolPanel.css'

type PoolStateFilter = 'all' | 'included' | 'excluded'
type PoolGroupBy = 'none' | 'class' | 'rarity' | 'releaseYear' | 'mainFaction' | 'acquisition'
type PoolOperatorSort = 'default' | 'alphabetical' | 'releaseDate'
type SortDirection = 'asc' | 'desc'

function PoolPortrait({ operator }: { operator: Operator }): React.JSX.Element {
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
    case 'limited': return 'Limited'
    case 'standard': return 'Standard'
    case 'welfare': return 'Welfare'
  }
}

function mainFactionLabel(operator: Operator, dataset: OperatorDataset): string {
  const chain = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
  const labels = chain.map((id) => dataset.factionLabels[id] ?? id)
  if (labels.length === 0) return 'Unaffiliated'
  if (labels.length === 1) return labels[0]
  return `${labels[0]} (${labels.at(-1)})`
}

function groupLabel(
  operator: Operator,
  groupBy: PoolGroupBy,
  dataset: OperatorDataset,
  constraints: RandomizerConstraints,
): string {
  switch (groupBy) {
    case 'class': return dataset.classLabels?.[operator.class] ?? operator.class
    case 'rarity': return `${operator.rarity}★`
    case 'releaseYear': {
      const year = operator.release[constraints.release.server].yearGroup
      return year === null ? 'Unknown release group' : releaseGroupLabel(year)
    }
    case 'mainFaction': return mainFactionLabel(operator, dataset)
    case 'acquisition': return acquisitionLabel(operator)
    case 'none': return 'All operators'
  }
}

function compareDefaultOperators(left: Operator, right: Operator): number {
  if (left.rarity !== right.rarity) return right.rarity - left.rarity
  const classDifference = operatorClasses.indexOf(left.class) - operatorClasses.indexOf(right.class)
  if (classDifference !== 0) return classDifference
  return left.name.localeCompare(right.name)
}

function compareOperators(
  left: Operator,
  right: Operator,
  sort: PoolOperatorSort,
  constraints: RandomizerConstraints,
): number {
  if (sort === 'alphabetical') return left.name.localeCompare(right.name)
  if (sort === 'releaseDate') {
    const leftDate = left.release[constraints.release.server].date
    const rightDate = right.release[constraints.release.server].date
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate)
    if (leftDate && !rightDate) return -1
    if (!leftDate && rightDate) return 1
  }
  return compareDefaultOperators(left, right)
}

function groupOrderValue(
  label: string,
  operators: Operator[],
  groupBy: PoolGroupBy,
  constraints: RandomizerConstraints,
): number | string {
  if (groupBy === 'class') return operatorClasses.indexOf(operators[0]?.class)
  if (groupBy === 'rarity') return operators[0]?.rarity ?? 0
  if (groupBy === 'releaseYear') {
    return operators[0]?.release[constraints.release.server].yearGroup ?? Number.MAX_SAFE_INTEGER
  }
  return label.toLocaleLowerCase()
}

function OperatorEntry({
  operator,
  factionLabel,
  classLabel,
  included,
  presentation,
  onToggle,
}: {
  operator: Operator
  factionLabel: string
  classLabel: string
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
    'data-rarity': operator.rarity,
  }

  if (presentation === 'imageGrid') {
    return (
      <button {...commonProps} className={`pool-entry pool-entry--image${included ? '' : ' is-excluded'}`}>
        <PoolPortrait operator={operator} />
      </button>
    )
  }

  if (presentation === 'compactCard') {
    return (
      <button {...commonProps} className={`pool-entry pool-entry--compact${included ? '' : ' is-excluded'}`}>
        <PoolPortrait operator={operator} />
        <span className="pool-entry-copy"><strong>{operator.name}</strong></span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }

  if (presentation === 'simpleList') {
    return (
      <button {...commonProps} className={`pool-entry pool-entry--list${included ? '' : ' is-excluded'}`}>
        <PoolPortrait operator={operator} />
        <strong>{operator.name}</strong>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }

  return (
    <button {...commonProps} className={`pool-entry pool-entry--detailed${included ? '' : ' is-excluded'}`}>
      <PoolPortrait operator={operator} />
      <span className="pool-entry-copy">
        <strong>{operator.name}</strong>
        <small>{operator.rarity}★ · {classLabel} · {operator.subclass.name}</small>
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
  const [groupDirection, setGroupDirection] = useState<SortDirection>('asc')
  const [operatorSort, setOperatorSort] = useState<PoolOperatorSort>('default')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [reversedGroups, setReversedGroups] = useState<Set<string>>(() => new Set())

  const higherLevelEligible = useMemo(
    () => filterHigherLevelEligibleOperators(dataset.operators, constraints),
    [constraints, dataset],
  )
  const excludedIds = useMemo(() => new Set(preferences.excludedOperatorIds), [preferences.excludedOperatorIds])
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

    const entries = [...map.entries()].map(([label, operators]) => [
      label,
      [...operators].sort((left, right) => compareOperators(left, right, operatorSort, constraints)),
    ] as const)

    if (groupBy === 'none') return entries
    return entries.sort(([leftLabel, leftOperators], [rightLabel, rightOperators]) => {
      const left = groupOrderValue(leftLabel, leftOperators, groupBy, constraints)
      const right = groupOrderValue(rightLabel, rightOperators, groupBy, constraints)
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
      return groupDirection === 'asc' ? comparison : -comparison
    })
  }, [constraints, dataset, displayed, groupBy, groupDirection, operatorSort])

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

  const collapseAll = (): void => setCollapsedGroups(new Set(groups.map(([label]) => label)))
  const expandAll = (): void => setCollapsedGroups(new Set())
  const toggleGroupDirection = (): void => setGroupDirection((current) => current === 'asc' ? 'desc' : 'asc')
  const toggleOneGroupDirection = (label: string): void => {
    setReversedGroups((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
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
          <button className="secondary-button" type="button" disabled={displayed.length === 0} onClick={() => setDisplayedExcluded(false)}>Add displayed to pool</button>
          <button className="secondary-button" type="button" disabled={displayed.length === 0} onClick={() => setDisplayedExcluded(true)}>Remove displayed from pool</button>
          <button className="secondary-button" type="button" disabled={preferences.excludedOperatorIds.length === 0} onClick={() => onPreferencesChange({ ...preferences, excludedOperatorIds: [] })}>Reset individual exclusions</button>
        </div>
      </div>

      <div className="pool-search-row">
        <label className="field pool-search">
          <span>Search</span>
          <input type="search" value={search} placeholder="Search operators…" onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      <div className="pool-toolbar">
        <label className="field">
          <span>Pool state</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as PoolStateFilter)}>
            <option value="all">All</option>
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
        <label className="field">
          <span>Operator sort</span>
          <select value={operatorSort} onChange={(event) => setOperatorSort(event.target.value as PoolOperatorSort)}>
            <option value="default">Default</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="releaseDate">Release Date</option>
          </select>
        </label>
        <label className="field">
          <span>Group by</span>
          <select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as PoolGroupBy)
              setCollapsedGroups(new Set())
              setReversedGroups(new Set())
            }}
          >
            <option value="none">None</option>
            <option value="class">Class</option>
            <option value="rarity">Rarity</option>
            <option value="releaseYear">Release</option>
            <option value="mainFaction">Main Faction</option>
            <option value="acquisition">Acquisition</option>
          </select>
        </label>
      </div>

      {groupBy !== 'none' && (
        <div className="pool-group-actions">
          <button type="button" className="secondary-button" onClick={expandAll}>Expand all</button>
          <button type="button" className="secondary-button" onClick={collapseAll}>Collapse all</button>
        </div>
      )}

      <div className="pool-information" role="status">
        <div className="pool-information-copy">
          <strong>{finalPool.length} operators eligible</strong>
          <span>· {displayed.length} displayed</span>
          <span>· {higherLevelEligible.length} pass higher-level filters</span>
        </div>
        {groupBy !== 'none' && (
          <button
            type="button"
            className="pool-group-direction-toggle"
            aria-label={`Group order: ${groupDirection === 'asc' ? 'ascending' : 'descending'}. Toggle group order.`}
            title={`Group order: ${groupDirection === 'asc' ? 'Ascending' : 'Descending'}`}
            onClick={toggleGroupDirection}
          >
            <span aria-hidden="true">{groupDirection === 'asc' ? '↑' : '↓'}</span>
          </button>
        )}
      </div>

      <div className={`pool-groups pool-presentation--${preferences.poolPresentation}`}>
        {groups.map(([label, operators]) => {
          const collapsed = collapsedGroups.has(label)
          const reversed = reversedGroups.has(label)
          const visibleOperators = reversed ? [...operators].reverse() : operators
          return (
            <section className="pool-group" key={label}>
              {groupBy !== 'none' && (
                <div className="pool-group-heading">
                  <button
                    type="button"
                    className="pool-group-collapse"
                    aria-expanded={!collapsed}
                    onClick={() => setCollapsedGroups((current) => {
                      const next = new Set(current)
                      if (next.has(label)) next.delete(label)
                      else next.add(label)
                      return next
                    })}
                  >
                    <span>{collapsed ? '▸' : '▾'} {label}</span>
                    <span>{operators.length}</span>
                  </button>
                  <button
                    type="button"
                    className="pool-group-sort-toggle"
                    aria-label={`${label} operator order: ${reversed ? 'reversed' : 'normal'}. Toggle operator order.`}
                    title={`${label}: ${reversed ? 'Reverse' : 'Normal'} operator order`}
                    onClick={() => toggleOneGroupDirection(label)}
                  >
                    <span aria-hidden="true">{reversed ? '↓' : '↑'}</span>
                  </button>
                </div>
              )}
              {!collapsed && (
                <div className="pool-entries">
                  {visibleOperators.map((operator) => (
                    <OperatorEntry
                      key={operator.id}
                      operator={operator}
                      factionLabel={mainFactionLabel(operator, dataset)}
                      classLabel={dataset.classLabels?.[operator.class] ?? operator.class}
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
        {displayed.length === 0 && <div className="pool-empty">No operators match the current Pool view.</div>}
      </div>
    </section>
  )
}
