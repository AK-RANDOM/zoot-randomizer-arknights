import { useEffect, useMemo, useState } from 'react'
import { operatorClasses } from '../../shared/operator'
import {
  applyManualOperatorExclusions,
  buildGlobalFilterOperatorPool,
  setDisplayedOperatorsExcluded,
  setOperatorExcluded,
} from '../../shared/operatorPool'
import { releaseGroupLabel } from '../../shared/releaseBounds'
import { skinDisplayName } from '../../shared/skinMetadata'
import {
  appearanceChoiceForOperator,
  appearanceLabel,
  notifyOperatorAppearanceChanged,
} from './operatorAppearance'
import './PoolPanel.css'

function PoolAvatar({ operator }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const avatarId = operator.defaultArts?.[0]?.avatarId

  useEffect(() => {
    let active = true
    setImageUrl(null)
    const request = avatarId
      ? window.desktop.getOperatorAvatarAsset(avatarId)
      : window.desktop.getOperatorImage(operator.id)
    void request.then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [avatarId, operator.id])

  return imageUrl ? (
    <img className="pool-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-avatar pool-avatar--fallback" aria-hidden="true">
      {operator.name.slice(0, 1)}
    </span>
  )
}

function acquisitionLabel(operator) {
  switch (operator.acquisition.family) {
    case 'limited':
      return 'Limited'
    case 'standard':
      return 'Standard'
    case 'welfare':
      return 'Welfare'
    default:
      return 'Unknown'
  }
}

function mainFactionLabel(operator, dataset) {
  const chain = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
  const labels = chain.map((id) => dataset.factionLabels[id] ?? id)
  if (labels.length === 0) return 'Unaffiliated'
  if (labels.length === 1) return labels[0]
  return `${labels[0]} (${labels.at(-1)})`
}

function operatorRaceLabel(operator, raceLabels) {
  const raceIds = operator.raceIds ?? []
  if (raceIds.length === 0) return raceLabels?.['race:unavailable'] ?? 'Unavailable'
  return raceIds.map((id) => raceLabels?.[id] ?? id).join(', ')
}

function groupLabel(operator, groupBy, dataset, constraints) {
  switch (groupBy) {
    case 'class':
      return dataset.classLabels?.[operator.class] ?? operator.class
    case 'rarity':
      return `${operator.rarity}★`
    case 'releaseYear': {
      const year = operator.release[constraints.release.server].yearGroup
      return year === null ? 'Unknown release group' : releaseGroupLabel(year)
    }
    case 'mainFaction':
      return mainFactionLabel(operator, dataset)
    case 'acquisition':
      return acquisitionLabel(operator)
    case 'none':
      return 'All operators'
  }
}

function compareDefaultOperators(left, right) {
  if (left.rarity !== right.rarity) return right.rarity - left.rarity
  const classDifference =
    operatorClasses.indexOf(left.class) - operatorClasses.indexOf(right.class)
  if (classDifference !== 0) return classDifference
  return left.name.localeCompare(right.name)
}

function comparePoolOperators(left, right, sort, constraints) {
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

function groupOrderValue(label, operators, groupBy, constraints) {
  if (groupBy === 'class') return operatorClasses.indexOf(operators[0]?.class)
  if (groupBy === 'rarity') return operators[0]?.rarity ?? 0
  if (groupBy === 'releaseYear') {
    return operators[0]?.release[constraints.release.server].yearGroup ?? Number.MAX_SAFE_INTEGER
  }
  return label.toLocaleLowerCase()
}

function comparePoolGroups(leftEntry, rightEntry, groupBy, constraints, direction) {
  const [leftLabel, leftOperators] = leftEntry
  const [rightLabel, rightOperators] = rightEntry
  const left = groupOrderValue(leftLabel, leftOperators, groupBy, constraints)
  const right = groupOrderValue(rightLabel, rightOperators, groupBy, constraints)
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true })
  return direction === 'asc' ? comparison : -comparison
}

function collapseAllPoolGroups(groups) {
  return new Set(groups.map(([label]) => label))
}

function expandAllPoolGroups() {
  return new Set()
}

function OperatorEntry({
  operator,
  factionLabel,
  raceLabel,
  classLabel,
  included,
  presentation,
  appearanceName,
  onToggle,
  onAppearance,
}) {
  const stateLabel = included ? 'Included' : 'Excluded'
  const commonProps = {
    type: 'button' as const,
    'aria-pressed': included,
    'aria-label': `${operator.name}, ${stateLabel}`,
    title: `${operator.name} — ${stateLabel}`,
    onClick: onToggle,
    'data-rarity': operator.rarity,
  }
  const avatar = <PoolAvatar operator={operator} />
  let entry

  if (presentation === 'imageGrid') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--image${included ? '' : ' is-excluded'}`}
      >
        {avatar}
      </button>
    )
  } else if (presentation === 'compactCard') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--compact${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <span className="pool-entry-copy">
          <strong>{operator.name}</strong>
        </span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  } else if (presentation === 'simpleList') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--list${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <strong>{operator.name}</strong>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  } else {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--detailed${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <span className="pool-entry-copy">
          <strong>{operator.name}</strong>
          <small>
            {operator.rarity}★ · {classLabel} · {operator.subclass.name}
          </small>
          <small>Main faction: {factionLabel}</small>
          <small>Race: {raceLabel}</small>
        </span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }

  return (
    <div className={`pool-entry-shell pool-entry-shell--${presentation}`}>
      {entry}
      <button
        type="button"
        className="pool-appearance-button"
        onClick={onAppearance}
        aria-label={`Choose artwork for ${operator.name}`}
        title={`${operator.name} artwork: ${appearanceName}`}
      >
        Art
      </button>
    </div>
  )
}

function AppearanceAvatar({ avatarId, fallbackLabel }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    if (!avatarId) return () => undefined
    void window.desktop.getOperatorAvatarAsset(avatarId).then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [avatarId])

  return imageUrl ? (
    <img className="pool-appearance-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-appearance-avatar pool-appearance-avatar--fallback" aria-hidden="true">
      {fallbackLabel}
    </span>
  )
}

function PromotionChoiceAvatar({ operatorId, promotionArt }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorPromotionAvatar(operatorId, promotionArt).then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [operatorId, promotionArt])

  return imageUrl ? (
    <img className="pool-appearance-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-appearance-avatar pool-appearance-avatar--fallback" aria-hidden="true">
      {promotionArt.toUpperCase()}
    </span>
  )
}

function compareSkinsByRelease(left, right) {
  if (left.releaseTime !== undefined && right.releaseTime !== undefined) {
    if (left.releaseTime !== right.releaseTime) return left.releaseTime - right.releaseTime
  } else if (left.releaseTime !== undefined) {
    return -1
  } else if (right.releaseTime !== undefined) {
    return 1
  }
  return left.id.localeCompare(right.id)
}

function defaultArtChoice(defaultArt, index, count) {
  if (count <= 1 || index === 0) return 'e1'
  if (index === count - 1) return 'e2'
  return `skin:${defaultArt.id}`
}

function AppearancePicker({ operator, preferences, onChoose, onClose }) {
  const selected = appearanceChoiceForOperator(preferences, operator.id)
  const defaultArts = operator.defaultArts ?? []
  const skins = (operator.skins ?? [])
    .filter((skin) => !skin.isDefault)
    .sort(compareSkinsByRelease)

  return (
    <div className="pool-appearance-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="pool-appearance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pool-appearance-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pool-appearance-dialog__heading">
          <div>
            <p className="eyebrow">OPERATOR APPEARANCE</p>
            <h3 id="pool-appearance-heading">{operator.name}</h3>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="pool-appearance-section" aria-labelledby="pool-default-art-heading">
          <h4 id="pool-default-art-heading">Default Art</h4>
          <div className="pool-appearance-grid pool-appearance-grid--default">
            {defaultArts.length > 0 ? (
              defaultArts.map((art, index) => {
                const choice = defaultArtChoice(art, index, defaultArts.length)
                return (
                  <button
                    key={art.id}
                    type="button"
                    className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                    onClick={() => onChoose(choice)}
                  >
                    <AppearanceAvatar avatarId={art.avatarId} fallbackLabel={art.label} />
                    <span className="pool-appearance-tile__copy">
                      <strong>{art.label}</strong>
                    </span>
                  </button>
                )
              })
            ) : (
              (['e1', 'e2'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                  onClick={() => onChoose(choice)}
                >
                  <PromotionChoiceAvatar operatorId={operator.id} promotionArt={choice} />
                  <span className="pool-appearance-tile__copy">
                    <strong>{choice.toUpperCase()}</strong>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="pool-appearance-section" aria-labelledby="pool-skins-heading">
          <h4 id="pool-skins-heading">Skins</h4>
          {skins.length > 0 ? (
            <div className="pool-appearance-grid pool-appearance-grid--skins">
              {skins.map((skin) => {
                const choice = `skin:${skin.id}`
                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                    onClick={() => onChoose(choice)}
                  >
                    <AppearanceAvatar avatarId={skin.avatarId} fallbackLabel="?" />
                    <span className="pool-appearance-tile__copy">
                      <strong>{skinDisplayName(skin, preferences.gameLocale)}</strong>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="pool-appearance-empty">No alternate skins available.</p>
          )}
        </section>

        <button
          type="button"
          className={`pool-appearance-random${selected === 'random' ? ' is-selected' : ''}`}
          onClick={() => onChoose('random')}
        >
          Random image
        </button>
      </div>
    </div>
  )
}

function PoolPanel({ dataset, constraints, preferences, onPreferencesChange }) {
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
    () =>
      applyManualOperatorExclusions(globalFilterEligible, preferences.excludedOperatorIds),
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
      const label = groupLabel(operator, groupBy, dataset, constraints)
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
  }, [constraints, dataset, displayed, groupBy, groupDirection, operatorSort])

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
      operatorAppearances: { ...preferences.operatorAppearances, [operator.id]: choice },
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
          </select>
        </label>
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

      <div className="pool-information" role="status">
        <div className="pool-information-copy">
          <strong>{finalPool.length} operators eligible</strong>
          <span>· {displayed.length} displayed</span>
          <span>· {globalFilterEligible.length} pass Global Filter</span>
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
                        appearanceName={appearanceLabel(
                          operator,
                          appearanceChoice,
                          preferences.gameLocale,
                          preferences.appearanceRandomSeed,
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
