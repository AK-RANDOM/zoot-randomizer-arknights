import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import {
  operatorGenders,
  type OperatorClass,
  type OperatorDataset,
  type OperatorGender,
} from '../../shared/operator'
import {
  buildFactionTree,
  buildRaceFilterGroups,
  buildRaceFilterIds,
  buildSubclassFilterGroups,
  descendantFactionIds,
  factionNodeState,
  regionalFilterDataset,
  type FactionNode,
} from '../../shared/operatorFilterCatalog'
import ClassIcon from './ClassIcon'
import { FactionIcon, SubclassIcon } from './FilterAssetIcon'
import './OperatorFilters.css'

function withExclusion<Id extends string>(current: readonly Id[], id: Id, enabled: boolean): Id[] {
  if (enabled) return current.filter((value) => value !== id)
  return current.includes(id) ? [...current] : [...current, id]
}

const genderLabels: Record<OperatorGender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Others',
}

function MixedFactionMark(): React.JSX.Element {
  return (
    <span className="operator-filter-faction-state" aria-hidden="true">
      −
    </span>
  )
}

function FactionChip({
  node,
  excluded,
  onToggle,
  standalone = false,
}: {
  node: FactionNode
  excluded: Set<string>
  onToggle: (node: FactionNode, enabled: boolean) => void
  standalone?: boolean
}): React.JSX.Element {
  const { allEnabled, mixed } = factionNodeState(node, excluded)
  return (
    <button
      type="button"
      className={`operator-filter-faction-chip${standalone ? ' is-standalone' : ''}${allEnabled ? ' is-enabled' : ''}${mixed ? ' is-mixed' : ''}`}
      aria-pressed={allEnabled}
      onClick={() => onToggle(node, !allEnabled)}
    >
      <FactionIcon id={node.id} className="operator-filter-faction-chip-icon" />
      <span>{node.name}</span>
      {mixed && <MixedFactionMark />}
    </button>
  )
}

function FactionGroup({
  node,
  excluded,
  onToggle,
}: {
  node: FactionNode
  excluded: Set<string>
  onToggle: (node: FactionNode, enabled: boolean) => void
}): React.JSX.Element {
  const { allEnabled, mixed } = factionNodeState(node, excluded)
  return (
    <div className="operator-filter-faction-group">
      <button
        type="button"
        className={`operator-filter-faction-parent${allEnabled ? ' is-enabled' : ''}${mixed ? ' is-mixed' : ''}`}
        aria-pressed={allEnabled}
        onClick={() => onToggle(node, !allEnabled)}
      >
        <FactionIcon id={node.id} className="operator-filter-faction-icon" />
        <span className="operator-filter-faction-label">{node.name}</span>
        {mixed && <MixedFactionMark />}
      </button>
      <div className="operator-filter-faction-child-chips">
        {node.children.map((child) => (
          <FactionChip key={child.id} node={child} excluded={excluded} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

export default function OperatorFilters({
  dataset: fullDataset,
  constraints,
  onChange,
  sourceFilters,
}: {
  dataset: OperatorDataset
  constraints: RandomizerConstraints
  onChange: (update: (current: RandomizerConstraints) => RandomizerConstraints) => void
  sourceFilters?: ReactNode
}): React.JSX.Element {
  const dataset = useMemo(
    () => regionalFilterDataset(fullDataset, constraints.release.server),
    [fullDataset, constraints.release.server],
  )
  const subclassesByClass = useMemo(
    () => buildSubclassFilterGroups(dataset, fullDataset.operators),
    [dataset, fullDataset],
  )
  const raceGroups = useMemo(() => buildRaceFilterGroups(dataset), [dataset])
  const [selectedClass, setSelectedClass] = useState<OperatorClass | null>(null)
  const subclassFilterRef = useRef<HTMLFieldSetElement>(null)
  const factionTree = useMemo(() => buildFactionTree(dataset), [dataset])
  const factionGroups = useMemo(
    () => factionTree.filter((node) => node.children.length > 0),
    [factionTree],
  )
  const standaloneFactions = useMemo(
    () => factionTree.filter((node) => node.children.length === 0),
    [factionTree],
  )
  const excludedSubclasses = new Set(constraints.subclass.excludedIds)
  const excludedFactions = new Set(constraints.faction.excludedIds)
  const excludedRaces = new Set(constraints.race?.excludedIds ?? [])
  const selectedSubclasses = selectedClass
    ? (subclassesByClass.find(({ operatorClass }) => operatorClass === selectedClass)?.subclasses ??
      [])
    : []
  const allSubclassIds = useMemo(
    () => subclassesByClass.flatMap(({ subclasses }) => subclasses.map(({ id }) => id)),
    [subclassesByClass],
  )
  const allFactionIds = useMemo(
    () => [...new Set(factionTree.flatMap(descendantFactionIds))],
    [factionTree],
  )
  const allRaceIds = useMemo(() => buildRaceFilterIds(dataset), [dataset])

  useEffect(() => {
    const closeSubclassPanel = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && !subclassFilterRef.current?.contains(target)) {
        setSelectedClass(null)
      }
    }
    document.addEventListener('pointerdown', closeSubclassPanel)
    document.addEventListener('focusin', closeSubclassPanel)
    return () => {
      document.removeEventListener('pointerdown', closeSubclassPanel)
      document.removeEventListener('focusin', closeSubclassPanel)
    }
  }, [])

  const setAllSubclassState = (enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      subclass: {
        excludedIds: enabled
          ? current.subclass.excludedIds.filter((id) => !allSubclassIds.includes(id))
          : [...new Set([...current.subclass.excludedIds, ...allSubclassIds])],
      },
    }))
  }
  const setAllFactionState = (enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      faction: {
        ...current.faction,
        excludedIds: enabled
          ? current.faction.excludedIds.filter((id) => !allFactionIds.includes(id))
          : [...new Set([...current.faction.excludedIds, ...allFactionIds])],
      },
    }))
  }
  const setAllRaceState = (enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      race: {
        excludedIds: enabled
          ? (current.race?.excludedIds ?? []).filter((id) => !allRaceIds.includes(id))
          : [...new Set([...(current.race?.excludedIds ?? []), ...allRaceIds])],
      },
    }))
  }
  const setSelectedClassState = (enabled: boolean): void => {
    onChange((current) => {
      const next = new Set(current.subclass.excludedIds)
      for (const subclass of selectedSubclasses) {
        if (enabled) next.delete(subclass.id)
        else next.add(subclass.id)
      }
      return { ...current, subclass: { excludedIds: [...next] } }
    })
  }
  const toggleFaction = (node: FactionNode, enabled: boolean): void => {
    onChange((current) => {
      const next = new Set(current.faction.excludedIds)
      for (const id of descendantFactionIds(node)) {
        if (enabled) next.delete(id)
        else next.add(id)
      }
      return { ...current, faction: { ...current.faction, excludedIds: [...next] } }
    })
  }
  const toggleRace = (raceId: string, enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      race: { excludedIds: withExclusion(current.race?.excludedIds ?? [], raceId, enabled) },
    }))
  }

  const selectedClassLabel = selectedClass
    ? (dataset.classLabels?.[selectedClass] ?? selectedClass)
    : null

  return (
    <div className="operator-filter-layout">
      {sourceFilters}

      <fieldset className="constraint-group detail-group special-rules-group">
        <legend>Alter Exclusivity</legend>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={constraints.alterExclusivity}
            onChange={(event) =>
              onChange((current) => ({ ...current, alterExclusivity: event.target.checked }))
            }
          />
          <span>
            <strong>Allow only one version from each character family</strong>
            <small>Amiya forms remain mutually exclusive regardless of this toggle.</small>
          </span>
        </label>
      </fieldset>

      <fieldset
        ref={subclassFilterRef}
        className="constraint-group detail-group operator-filter-subclass-filter"
      >
        <legend>Subclass</legend>
        <div className="operator-filter-global-actions">
          <span>All classes</span>
          <div className="operator-filter-subclass-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllSubclassState(true)}
            >
              All
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllSubclassState(false)}
            >
              None
            </button>
          </div>
        </div>
        <div
          className="operator-filter-class-selector"
          role="tablist"
          aria-label="Subclass parent class"
        >
          {subclassesByClass.map(({ operatorClass, subclasses }) => {
            const enabledCount = subclasses.filter(({ id }) => !excludedSubclasses.has(id)).length
            const classLabel = dataset.classLabels?.[operatorClass] ?? operatorClass
            return (
              <button
                key={operatorClass}
                type="button"
                className={`operator-filter-class-tab${selectedClass === operatorClass ? ' is-active' : ''}`}
                aria-selected={selectedClass === operatorClass}
                onClick={() => setSelectedClass(operatorClass)}
              >
                <ClassIcon operatorClass={operatorClass} className="operator-filter-class-icon" />
                <span>{classLabel}</span>
                <small>
                  {enabledCount}/{subclasses.length}
                </small>
              </button>
            )
          })}
        </div>
        {selectedClass && selectedClassLabel && (
          <div className="operator-filter-subclass-panel">
            <div className="operator-filter-subclass-panel-heading">
              <strong>{selectedClassLabel} subclasses</strong>
              <div className="operator-filter-subclass-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedClassState(true)}
                >
                  All
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedClassState(false)}
                >
                  None
                </button>
              </div>
            </div>
            <div className="operator-filter-subclass-tiles">
              {selectedSubclasses.map((subclass) => {
                const enabled = !excludedSubclasses.has(subclass.id)
                return (
                  <button
                    key={subclass.id}
                    type="button"
                    className={`operator-filter-subclass-tile${enabled ? ' is-enabled' : ''}`}
                    aria-pressed={enabled}
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        subclass: {
                          excludedIds: withExclusion(
                            current.subclass.excludedIds,
                            subclass.id,
                            !enabled,
                          ),
                        },
                      }))
                    }
                  >
                    <SubclassIcon id={subclass.id} className="operator-filter-subclass-icon" />
                    <span>{subclass.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="constraint-group detail-group operator-filter-faction-filter">
        <legend>Gender</legend>
        <div className="operator-filter-global-actions">
          <span>All genders</span>
          <div className="operator-filter-subclass-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => onChange((current) => ({ ...current, gender: { excludedIds: [] } }))}
            >
              All
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  gender: { excludedIds: [...operatorGenders] },
                }))
              }
            >
              None
            </button>
          </div>
        </div>
        <div className="operator-filter-faction-standalone-chips">
          {operatorGenders.map((id) => {
            const enabled = !constraints.gender?.excludedIds.includes(id)
            return (
              <button
                key={id}
                type="button"
                className={`operator-filter-faction-chip operator-filter-race-chip is-standalone${enabled ? ' is-enabled' : ''}`}
                aria-pressed={enabled}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    gender: {
                      excludedIds: withExclusion(current.gender?.excludedIds ?? [], id, !enabled),
                    },
                  }))
                }
              >
                <span>{genderLabels[id]}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="constraint-group detail-group operator-filter-faction-filter">
        <legend>Race</legend>
        <div className="operator-filter-global-actions">
          <span>All races</span>
          <div className="operator-filter-subclass-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllRaceState(true)}
            >
              All
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllRaceState(false)}
            >
              None
            </button>
          </div>
        </div>
        {raceGroups.map(
          (group) =>
            group.races.length > 0 && (
              <div className="operator-filter-faction-standalone" key={group.key}>
                <span className="operator-filter-faction-standalone-label">{group.label}</span>
                <div className="operator-filter-faction-standalone-chips">
                  {group.races.map((race) => {
                    const enabled = !excludedRaces.has(race.id)
                    return (
                      <button
                        key={race.id}
                        type="button"
                        className={`operator-filter-faction-chip operator-filter-race-chip is-standalone${enabled ? ' is-enabled' : ''}`}
                        aria-pressed={enabled}
                        title={`${race.operatorCount} operator${race.operatorCount === 1 ? '' : 's'}`}
                        onClick={() => toggleRace(race.id, !enabled)}
                      >
                        <span>{race.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ),
        )}
        <p className="filter-note">
          Common races have 5+ operators, Rare races have 2–4, and One-off races have 1 in the
          currently loaded dataset. Stable Race IDs remain the filter identity.
        </p>
      </fieldset>

      <fieldset className="constraint-group detail-group operator-filter-faction-filter">
        <legend>Factions</legend>
        <div className="operator-filter-global-actions">
          <span>All factions</span>
          <div className="operator-filter-subclass-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllFactionState(true)}
            >
              All
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAllFactionState(false)}
            >
              None
            </button>
          </div>
        </div>
        <label className="field operator-filter-faction-mode">
          <span>Match using</span>
          <select
            value={constraints.faction.matchMode}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                faction: {
                  ...current.faction,
                  matchMode: event.target.value as RandomizerConstraints['faction']['matchMode'],
                },
              }))
            }
          >
            <option value="main">Main faction</option>
            <option value="any">Any affiliation</option>
          </select>
        </label>
        <div className="operator-filter-faction-matrix">
          {factionGroups.map((node) => (
            <FactionGroup
              key={node.id}
              node={node}
              excluded={excludedFactions}
              onToggle={toggleFaction}
            />
          ))}
        </div>
        {standaloneFactions.length > 0 && (
          <div className="operator-filter-faction-standalone">
            <span className="operator-filter-faction-standalone-label">Standalone</span>
            <div className="operator-filter-faction-standalone-chips">
              {standaloneFactions.map((node) => (
                <FactionChip
                  key={node.id}
                  node={node}
                  excluded={excludedFactions}
                  onToggle={toggleFaction}
                  standalone
                />
              ))}
            </div>
          </div>
        )}
        <p className="filter-note">
          Parent controls apply only to explicitly encoded descendants. Re-enabling a child leaves
          its parent in a mixed state while keeping that child selectable.
        </p>
      </fieldset>
    </div>
  )
}
