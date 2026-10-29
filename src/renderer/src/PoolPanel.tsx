import { useMemo, useState } from 'react'
import {
  applyManualOperatorExclusions,
  buildGlobalFilterOperatorPool,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
} from '../../shared/operatorPool'
import {
  appearanceChoiceForOperator,
  appearanceLabel,
  notifyOperatorAppearanceChanged,
  resolveAccountAppearance,
} from './operatorAppearance'
import { useImportedArknightsAccount } from './arknightsAccountState'
import AppearancePicker, { compareSkinsByRelease, defaultArtChoice } from './PoolAppearancePicker'
import {
  collapseAllPoolGroups,
  comparePoolGroups,
  comparePoolOperators,
  expandAllPoolGroups,
  mainFactionLabel,
  OperatorEntry,
  operatorRaceLabel,
  groupLabel,
} from './PoolPanelPresentation'
import './PoolPanel.css'
function PoolPanel({ dataset, constraints, preferences, onPreferencesChange }) {
  const importedAccount = useImportedArknightsAccount() ?? null
  const [stateFilter, setStateFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState('none')
  const [groupDirection, setGroupDirection] = useState('asc')
  const [operatorSort, setOperatorSort] = useState('default')
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
  const [reversedGroups, setReversedGroups] = useState(() => new Set())
  const [appearanceOperator, setAppearanceOperator] = useState(null)
  const globalFilterEligible = useMemo(
    () => buildGlobalFilterOperatorPool(dataset.operators, constraints),
    [constraints, dataset],
  )
  const excludedIds = useMemo(
    () => new Set(preferences.excludedOperatorIds),
    [preferences.excludedOperatorIds],
  )
  const finalPool = useMemo(
    () => applyManualOperatorExclusions(globalFilterEligible, preferences.excludedOperatorIds),
    [globalFilterEligible, preferences.excludedOperatorIds],
  )
  const displayed = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return globalFilterEligible.filter((operator) => {
      const excluded = excludedIds.has(operator.id)
      if (stateFilter === 'included' && excluded) return false
      if (stateFilter === 'excluded' && !excluded) return false
      if (query && !operator.name.toLocaleLowerCase().includes(query)) return false
      return true
    })
  }, [excludedIds, globalFilterEligible, search, stateFilter])
  const groups = useMemo(() => {
    const map = new Map()
    for (const operator of displayed) {
      const label = groupLabel(operator, groupBy, dataset, constraints, importedAccount)
      const values = map.get(label) ?? []
      values.push(operator)
      map.set(label, values)
    }
    const entries = [...map.entries()].map(([label, operators]) => [
      label,
      [...operators].sort((left, right) =>
        comparePoolOperators(left, right, operatorSort, constraints),
      ),
    ])
    if (groupBy === 'none') return entries
    return entries.sort((left, right) =>
      comparePoolGroups(left, right, groupBy, constraints, groupDirection),
    )
  }, [constraints, dataset, displayed, groupBy, groupDirection, importedAccount, operatorSort])
  const setDisplayedExcluded = (excluded) => {
    onPreferencesChange({
      ...preferences,
      excludedOperatorIds: setDisplayedOperatorsExcluded(
        preferences.excludedOperatorIds,
        displayed.map((operator) => operator.id),
        excluded,
      ),
    })
  }
  const toggleOperator = (operator) => {
    onPreferencesChange({
      ...preferences,
      excludedOperatorIds: setOperatorExcluded(
        preferences.excludedOperatorIds,
        operator.id,
        !excludedIds.has(operator.id),
      ),
    })
  }
  const chooseAppearance = (operator, choice) => {
    onPreferencesChange({
      ...preferences,
      operatorAppearances: {
        ...preferences.operatorAppearances,
        [operator.id]: choice,
      },
    })
    notifyOperatorAppearanceChanged()
    setAppearanceOperator(null)
  }
  const collapseAll = () => setCollapsedGroups(collapseAllPoolGroups(groups))
  const expandAll = () => setCollapsedGroups(expandAllPoolGroups())
  const toggleGroupDirection = () =>
    setGroupDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
  const toggleOneGroupDirection = (label) => {
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
          <p className="eyebrow">SETUP • GLOBAL POOL • CURATE</p>
          <h2 id="pool-heading">Curate operators</h2>
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
            onClick={() => onPreferencesChange({ ...preferences, excludedOperatorIds: [] })}
          >
            Reset individual exclusions
          </button>
        </div>
      </div>

      <div className="pool-search-row">
        <label className="field pool-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Search operators…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="pool-toolbar">
        <label className="field">
          <span>Pool state</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
        <label className="field">
          <span>Operator sort</span>
          <select value={operatorSort} onChange={(event) => setOperatorSort(event.target.value)}>
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
              setGroupBy(event.target.value)
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
            <option value="accountState">Account State</option>
          </select>
        </label>
      </div>

      <div className="pool-information" role="status">
        <div className="pool-information-copy">
          <strong>{finalPool.length} operators eligible</strong>
          <span>· {displayed.length} displayed</span>
          <span>· {globalFilterEligible.length} pass Global Filter</span>
        </div>
        {groupBy !== 'none' ? (
          <button
            type="button"
            className="pool-group-direction-toggle"
            aria-label={`Group order: ${groupDirection === 'asc' ? 'ascending' : 'descending'}. Toggle group order.`}
            title={`Group order: ${groupDirection === 'asc' ? 'Ascending' : 'Descending'}`}
            onClick={toggleGroupDirection}
          >
            <span aria-hidden="true">{groupDirection === 'asc' ? '↑' : '↓'}</span>
          </button>
        ) : (
          <button
            type="button"
            className="pool-group-direction-toggle"
            aria-label={`Operator order: ${reversedGroups.has('All operators') ? 'reversed' : 'normal'}. Toggle operator order.`}
            title={`Operator order: ${reversedGroups.has('All operators') ? 'Reverse' : 'Normal'}`}
            onClick={() => toggleOneGroupDirection('All operators')}
          >
            <span aria-hidden="true">{reversedGroups.has('All operators') ? '↓' : '↑'}</span>
          </button>
        )}
      </div>

      {groupBy !== 'none' && (
        <div className="pool-group-actions">
          <button type="button" className="secondary-button" onClick={expandAll}>
            Expand all
          </button>
          <button type="button" className="secondary-button" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
      )}

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
                    onClick={() =>
                      setCollapsedGroups((current) => {
                        const next = new Set(current)
                        if (next.has(label)) next.delete(label)
                        else next.add(label)
                        return next
                      })
                    }
                  >
                    <span>
                      {collapsed ? '▸' : '▾'} {label}
                    </span>
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
                  {visibleOperators.map((operator) => {
                    const appearanceChoice = appearanceChoiceForOperator(preferences, operator.id)
                    return (
                      <OperatorEntry
                        key={operator.id}
                        operator={operator}
                        factionLabel={mainFactionLabel(operator, dataset)}
                        raceLabel={operatorRaceLabel(operator, dataset.raceLabels)}
                        classLabel={dataset.classLabels?.[operator.class] ?? operator.class}
                        included={!excludedIds.has(operator.id)}
                        presentation={preferences.poolPresentation}
                        appearanceChoice={appearanceChoice}
                        appearanceRandomSeed={preferences.appearanceRandomSeed}
                        accountAppearance={
                          resolveAccountAppearance(operator, importedAccount).choice
                        }
                        appearanceName={appearanceLabel(
                          operator,
                          appearanceChoice,
                          preferences.gameLocale,
                          preferences.appearanceRandomSeed,
                          resolveAccountAppearance(operator, importedAccount),
                        )}
                        onToggle={() => toggleOperator(operator)}
                        onAppearance={() => setAppearanceOperator(operator)}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
        {displayed.length === 0 && (
          <div className="pool-empty">No operators match the current Curate view.</div>
        )}
      </div>
      {appearanceOperator && (
        <AppearancePicker
          operator={appearanceOperator}
          preferences={preferences}
          importedAccount={importedAccount}
          onChoose={(choice) => chooseAppearance(appearanceOperator, choice)}
          onClose={() => setAppearanceOperator(null)}
        />
      )}
    </section>
  )
}
export {
  collapseAllPoolGroups,
  comparePoolGroups,
  comparePoolOperators,
  compareSkinsByRelease,
  defaultArtChoice,
  PoolPanel as default,
  expandAllPoolGroups,
  operatorRaceLabel,
}
