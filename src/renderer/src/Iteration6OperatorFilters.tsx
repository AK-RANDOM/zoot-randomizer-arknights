import { useMemo, useState } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import { operatorClasses, type OperatorClass, type OperatorDataset } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import { FactionIcon, SubclassIcon } from './FilterAssetIcon'
import './Iteration6OperatorFilters.css'

function withExclusion(current: readonly string[], id: string, enabled: boolean): string[] {
  if (enabled) return current.filter((value) => value !== id)
  return current.includes(id) ? [...current] : [...current, id]
}

interface FactionNode {
  id: string
  name: string
  children: FactionNode[]
}

function descendantIds(node: FactionNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)]
}

function factionNodeState(node: FactionNode, excluded: Set<string>): {
  allEnabled: boolean
  mixed: boolean
} {
  const ids = descendantIds(node)
  const enabledCount = ids.filter((id) => !excluded.has(id)).length
  const allEnabled = enabledCount === ids.length
  return { allEnabled, mixed: enabledCount > 0 && !allEnabled }
}

function buildFactionTree(dataset: OperatorDataset): FactionNode[] {
  const parents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  const displayedIds = new Set<string>()

  for (const operator of dataset.operators) {
    for (const factionId of operator.faction.affiliations) displayedIds.add(factionId)
    const chain = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
    for (let index = 0; index < chain.length - 1; index += 1) {
      const parent = chain[index]
      const child = chain[index + 1]
      if (parent === child) continue
      if (!parents.has(child)) parents.set(child, new Set())
      parents.get(child)?.add(parent)
      if (!children.has(parent)) children.set(parent, new Set())
      children.get(parent)?.add(child)
    }
  }

  // Catalog-visible factions stay standalone unless playable source data
  // explicitly supplies a parent-child chain for them.
  const dublinnId = Object.entries(dataset.factionLabels).find(([, label]) => label === 'Dublinn')?.[0]
  if (dublinnId) displayedIds.add(dublinnId)

  const parentByChild = new Map<string, string>()
  for (const [child, candidates] of parents) {
    if (candidates.size === 1) parentByChild.set(child, [...candidates][0])
  }

  const nodeFor = (id: string, seen = new Set<string>()): FactionNode => {
    if (seen.has(id)) return { id, name: dataset.factionLabels[id] ?? id, children: [] }
    const nextSeen = new Set(seen).add(id)
    const childIds = [...(children.get(id) ?? [])]
      .filter((child) => displayedIds.has(child) && parentByChild.get(child) === id)
      .sort((left, right) =>
        (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right),
      )
    return {
      id,
      name: dataset.factionLabels[id] ?? id,
      children: childIds.map((child) => nodeFor(child, nextSeen)),
    }
  }

  return [...displayedIds]
    .filter((id) => !parentByChild.has(id))
    .sort((left, right) =>
      (dataset.factionLabels[left] ?? left).localeCompare(dataset.factionLabels[right] ?? right),
    )
    .map((id) => nodeFor(id))
}

function FactionStateMark({ mixed, enabled }: { mixed: boolean; enabled: boolean }): React.JSX.Element {
  return (
    <span className="i6-faction-state" aria-hidden="true">
      {mixed ? '−' : enabled ? '✓' : ''}
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
      className={`i6-faction-chip${standalone ? ' is-standalone' : ''}${allEnabled ? ' is-enabled' : ''}${mixed ? ' is-mixed' : ''}`}
      aria-pressed={allEnabled}
      onClick={() => onToggle(node, !allEnabled)}
    >
      <FactionIcon id={node.id} className="i6-faction-chip-icon" />
      <span>{node.name}</span>
      <FactionStateMark mixed={mixed} enabled={allEnabled} />
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
    <div className="i6-faction-group">
      <button
        type="button"
        className={`i6-faction-parent${allEnabled ? ' is-enabled' : ''}${mixed ? ' is-mixed' : ''}`}
        aria-pressed={allEnabled}
        onClick={() => onToggle(node, !allEnabled)}
      >
        <FactionIcon id={node.id} className="i6-faction-icon" />
        <span className="i6-faction-label">{node.name}</span>
        <FactionStateMark mixed={mixed} enabled={allEnabled} />
      </button>
      <div className="i6-faction-child-chips">
        {node.children.map((child) => (
          <FactionChip key={child.id} node={child} excluded={excluded} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

export default function Iteration6OperatorFilters({
  dataset,
  constraints,
  onChange,
}: {
  dataset: OperatorDataset
  constraints: RandomizerConstraints
  onChange: (update: (current: RandomizerConstraints) => RandomizerConstraints) => void
}): React.JSX.Element {
  const subclassesByClass = useMemo(() => {
    return operatorClasses.map((operatorClass) => {
      const subclasses = new Map<string, string>()
      for (const operator of dataset.operators) {
        if (operator.class === operatorClass) subclasses.set(operator.subclass.id, operator.subclass.name)
      }
      return {
        operatorClass,
        subclasses: [...subclasses.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      }
    })
  }, [dataset])

  const [selectedClass, setSelectedClass] = useState<OperatorClass>('Vanguard')
  const factionTree = useMemo(() => buildFactionTree(dataset), [dataset])
  const factionGroups = useMemo(() => factionTree.filter((node) => node.children.length > 0), [factionTree])
  const standaloneFactions = useMemo(() => factionTree.filter((node) => node.children.length === 0), [factionTree])
  const excludedSubclasses = new Set(constraints.subclass.excludedIds)
  const excludedFactions = new Set(constraints.faction.excludedIds)
  const selectedSubclasses =
    subclassesByClass.find(({ operatorClass }) => operatorClass === selectedClass)?.subclasses ?? []
  const allSubclassIds = useMemo(
    () => subclassesByClass.flatMap(({ subclasses }) => subclasses.map(({ id }) => id)),
    [subclassesByClass],
  )
  const allFactionIds = useMemo(() => [...new Set(factionTree.flatMap(descendantIds))], [factionTree])

  const setAllSubclassState = (enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      subclass: { excludedIds: enabled ? [] : [...allSubclassIds] },
    }))
  }

  const setAllFactionState = (enabled: boolean): void => {
    onChange((current) => ({
      ...current,
      faction: { ...current.faction, excludedIds: enabled ? [] : [...allFactionIds] },
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
      for (const id of descendantIds(node)) {
        if (enabled) next.delete(id)
        else next.add(id)
      }
      return { ...current, faction: { ...current.faction, excludedIds: [...next] } }
    })
  }

  const selectedClassLabel = dataset.classLabels?.[selectedClass] ?? selectedClass

  return (
    <div className="i6-filter-layout">
      <fieldset className="constraint-group detail-group i6-era-filter">
        <legend>Kernel era</legend>
        <label className="field">
          <span>Release era</span>
          <select
            value={constraints.era}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                era: event.target.value as RandomizerConstraints['era'],
              }))
            }
          >
            <option value="all">All</option>
            <option value="kernel">Kernel-era</option>
            <option value="postKernel">Post-Kernel</option>
          </select>
        </label>
        <p className="filter-note">
          Kernel/Post-Kernel classifies 5★ and 6★ operators using the selected region&apos;s cutoff.
          1★–4★ operators remain available in either mode when other filters pass.
        </p>
      </fieldset>

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

      <fieldset className="constraint-group detail-group i6-subclass-filter">
        <legend>Subclass</legend>
        <div className="i6-filter-global-actions">
          <span>All classes</span>
          <div className="i6-subclass-actions">
            <button type="button" className="secondary-button" onClick={() => setAllSubclassState(true)}>All</button>
            <button type="button" className="secondary-button" onClick={() => setAllSubclassState(false)}>None</button>
          </div>
        </div>
        <div className="i6-class-selector" role="tablist" aria-label="Subclass parent class">
          {subclassesByClass.map(({ operatorClass, subclasses }) => {
            const enabledCount = subclasses.filter(({ id }) => !excludedSubclasses.has(id)).length
            const classLabel = dataset.classLabels?.[operatorClass] ?? operatorClass
            return (
              <button
                key={operatorClass}
                type="button"
                className={`i6-class-tab${selectedClass === operatorClass ? ' is-active' : ''}`}
                aria-selected={selectedClass === operatorClass}
                onClick={() => setSelectedClass(operatorClass)}
              >
                <ClassIcon operatorClass={operatorClass} className="i6-class-icon" />
                <span>{classLabel}</span>
                <small>{enabledCount}/{subclasses.length}</small>
              </button>
            )
          })}
        </div>
        <div className="i6-subclass-panel">
          <div className="i6-subclass-panel-heading">
            <strong>{selectedClassLabel} subclasses</strong>
            <div className="i6-subclass-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedClassState(true)}>All</button>
              <button type="button" className="secondary-button" onClick={() => setSelectedClassState(false)}>None</button>
            </div>
          </div>
          <div className="i6-subclass-tiles">
            {selectedSubclasses.map((subclass) => {
              const enabled = !excludedSubclasses.has(subclass.id)
              return (
                <button
                  key={subclass.id}
                  type="button"
                  className={`i6-subclass-tile${enabled ? ' is-enabled' : ''}`}
                  aria-pressed={enabled}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      subclass: {
                        excludedIds: withExclusion(current.subclass.excludedIds, subclass.id, !enabled),
                      },
                    }))
                  }
                >
                  <SubclassIcon id={subclass.id} className="i6-subclass-icon" />
                  <span>{subclass.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>

      <fieldset className="constraint-group detail-group i6-faction-filter">
        <legend>Factions</legend>
        <div className="i6-filter-global-actions">
          <span>All factions</span>
          <div className="i6-subclass-actions">
            <button type="button" className="secondary-button" onClick={() => setAllFactionState(true)}>All</button>
            <button type="button" className="secondary-button" onClick={() => setAllFactionState(false)}>None</button>
          </div>
        </div>
        <label className="field i6-faction-mode">
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
        <div className="i6-faction-matrix">
          {factionGroups.map((node) => (
            <FactionGroup key={node.id} node={node} excluded={excludedFactions} onToggle={toggleFaction} />
          ))}
        </div>
        {standaloneFactions.length > 0 && (
          <div className="i6-faction-standalone">
            <span className="i6-faction-standalone-label">Standalone</span>
            <div className="i6-faction-standalone-chips">
              {standaloneFactions.map((node) => (
                <FactionChip key={node.id} node={node} excluded={excludedFactions} onToggle={toggleFaction} standalone />
              ))}
            </div>
          </div>
        )}
        <p className="filter-note">
          Parent controls apply only to explicitly encoded descendants. Re-enabling a child leaves its parent in a mixed state while keeping that child selectable.
        </p>
      </fieldset>
    </div>
  )
}
