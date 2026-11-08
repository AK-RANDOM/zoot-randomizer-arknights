import type { OperatorFilterOption } from '../../shared/operatorFilterCatalog'
import { SubclassIcon } from './FilterAssetIcon'

export default function SlotSubclassSelector({
  classLabel,
  subclasses,
  allowedIds,
  availableIds,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  classLabel: string
  subclasses: readonly OperatorFilterOption[]
  allowedIds: readonly string[] | undefined
  availableIds: ReadonlySet<string>
  onToggle: (id: string) => void
  onSelectAll?: () => void
  onSelectNone?: () => void
}): React.JSX.Element {
  return (
    <div
      className="slot-constraint-subclass-selector"
      role="group"
      aria-label={`${classLabel} subclasses`}
    >
      <div className="slot-constraint-selector-icons">
        {subclasses.map((subclass) => {
          const available = availableIds.has(subclass.id)
          const enabled =
            available && (allowedIds === undefined || allowedIds.includes(subclass.id))
          return (
            <button
              key={subclass.id}
              type="button"
              className={`slot-constraint-subclass-icon-button${enabled ? ' is-active' : ''}${available ? '' : ' is-unavailable'}`}
              aria-pressed={enabled}
              disabled={!available}
              title={`${subclass.name} — ${enabled ? 'active' : 'inactive'}${available ? '' : '. No eligible operators with the current filters and slot criteria.'}`}
              onClick={() => onToggle(subclass.id)}
            >
              <SubclassIcon id={subclass.id} className="slot-constraint-subclass-icon" />
              <span className="sr-only">{subclass.name}</span>
            </button>
          )
        })}
      </div>
      {(onSelectAll || onSelectNone) && (
        <div className="slot-constraint-selector-actions">
          {onSelectAll && (
            <button type="button" className="quick-select" onClick={onSelectAll}>
              All
            </button>
          )}
          {onSelectNone && (
            <button type="button" className="quick-select" onClick={onSelectNone}>
              None
            </button>
          )}
        </div>
      )}
    </div>
  )
}
