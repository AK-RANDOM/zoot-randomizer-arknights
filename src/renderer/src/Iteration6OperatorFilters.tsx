import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import { operatorClasses, type OperatorDataset } from '../../shared/operator'
import './Iteration6OperatorFilters.css'

function FilterCheckbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: ReactNode
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label className="i6-filter-check">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function withExclusion(
  current: readonly string[],
  id: string,
  enabled: boolean,
): string[] {
  if (enabled) return current.filter((value) => value !== id)
  return current.includes(id) ? [...current] : [...current, id]
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
        if (operator.class === operatorClass) {
          subclasses.set(operator.subclass.id, operator.subclass.name)
        }
      }
      return {
        operatorClass,
        subclasses: [...subclasses.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      }
    })
  }, [dataset])

  const factions = useMemo(
    () =>
      Object.entries(dataset.factionLabels)
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [dataset],
  )

  const excludedSubclasses = new Set(constraints.subclass.excludedIds)
  const excludedFactions = new Set(constraints.faction.excludedIds)

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
          Era is determined only by the selected metadata region&apos;s release-date
          cutoff. Limited, collaboration, Welfare, and Standard operators follow
          the same rule.
        </p>
      </fieldset>

      <fieldset className="constraint-group detail-group i6-subclass-filter">
        <legend>Subclass</legend>
        <div className="i6-subclass-groups">
          {subclassesByClass.map(({ operatorClass, subclasses }) => {
            const enabledCount = subclasses.filter(
              ({ id }) => !excludedSubclasses.has(id),
            ).length
            const allEnabled = enabledCount === subclasses.length
            const someEnabled = enabledCount > 0
            return (
              <div className="i6-subclass-group" key={operatorClass}>
                <FilterCheckbox
                  label={<strong>{dataset.classLabels?.[operatorClass] ?? operatorClass}</strong>}
                  checked={allEnabled}
                  indeterminate={!allEnabled && someEnabled}
                  onChange={(enabled) =>
                    onChange((current) => {
                      const next = new Set(current.subclass.excludedIds)
                      for (const subclass of subclasses) {
                        if (enabled) next.delete(subclass.id)
                        else next.add(subclass.id)
                      }
                      return {
                        ...current,
                        subclass: { excludedIds: [...next] },
                      }
                    })
                  }
                />
                <div className="i6-subclass-children">
                  {subclasses.map((subclass) => (
                    <FilterCheckbox
                      key={subclass.id}
                      label={subclass.name}
                      checked={!excludedSubclasses.has(subclass.id)}
                      onChange={(enabled) =>
                        onChange((current) => ({
                          ...current,
                          subclass: {
                            excludedIds: withExclusion(
                              current.subclass.excludedIds,
                              subclass.id,
                              enabled,
                            ),
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="constraint-group detail-group i6-faction-filter">
        <legend>Factions</legend>
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
        <div className="i6-faction-grid">
          {factions.map((faction) => (
            <FilterCheckbox
              key={faction.id}
              label={faction.name}
              checked={!excludedFactions.has(faction.id)}
              onChange={(enabled) =>
                onChange((current) => ({
                  ...current,
                  faction: {
                    ...current.faction,
                    excludedIds: withExclusion(
                      current.faction.excludedIds,
                      faction.id,
                      enabled,
                    ),
                  },
                }))
              }
            />
          ))}
        </div>
        <p className="filter-note">
          Main faction is canonical for grouping. “Any affiliation” allows an
          operator when at least one recorded affiliation remains enabled.
        </p>
      </fieldset>
    </div>
  )
}
