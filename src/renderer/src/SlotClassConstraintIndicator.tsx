import ClassIcon from './ClassIcon'
import type { SlotConstraint } from '../../shared/constraints'
import {
  operatorClasses,
  type Operator,
  type OperatorClass,
} from '../../shared/operator'
import './SlotClassConstraintIndicator.css'

export interface SlotClassIndicatorItem {
  operatorClass: OperatorClass
  subclassNames: string[]
}

export function buildSlotClassIndicatorItems(
  constraint: SlotConstraint,
  operators: readonly Operator[],
  classOverride?: readonly OperatorClass[],
): SlotClassIndicatorItem[] {
  const selectedSubclassIds = new Set(constraint.subclasses ?? [])
  const inferredClasses =
    constraint.classes.length > 0
      ? [...constraint.classes]
      : selectedSubclassIds.size > 0
        ? [...new Set(
            operators
              .filter((operator) => selectedSubclassIds.has(operator.subclass.id))
              .map((operator) => operator.class),
          )]
        : []
  const requestedClasses =
    classOverride && classOverride.length > 0
      ? [...new Set(classOverride)]
      : operatorClasses.filter((operatorClass) => inferredClasses.includes(operatorClass))

  return requestedClasses.map((operatorClass) => {
    const subclassNames =
      selectedSubclassIds.size === 0
        ? []
        : [...new Map(
            operators
              .filter(
                (operator) =>
                  operator.class === operatorClass &&
                  selectedSubclassIds.has(operator.subclass.id),
              )
              .map((operator) => [operator.subclass.id, operator.subclass.name]),
          ).values()].sort((left, right) => left.localeCompare(right))
    return { operatorClass, subclassNames }
  })
}

export function splitSlotClassIndicatorItems(
  items: readonly SlotClassIndicatorItem[],
  maxVisible = 3,
): { visible: SlotClassIndicatorItem[]; overflow: number } {
  const visible = items.slice(0, Math.max(0, maxVisible))
  return { visible, overflow: Math.max(0, items.length - visible.length) }
}

export default function SlotClassConstraintIndicator({
  constraint,
  operators,
  classes,
  side = 'right',
  maxVisible = 3,
}: {
  constraint: SlotConstraint
  operators: readonly Operator[]
  classes?: readonly OperatorClass[]
  side?: 'left' | 'right'
  maxVisible?: number
}): React.JSX.Element | null {
  const items = buildSlotClassIndicatorItems(constraint, operators, classes)
  if (items.length === 0) return null

  const { visible, overflow } = splitSlotClassIndicatorItems(items, maxVisible)
  const description = items
    .map(({ operatorClass, subclassNames }) =>
      subclassNames.length > 0
        ? `${operatorClass}: ${subclassNames.join(', ')}`
        : operatorClass,
    )
    .join('; ')

  return (
    <span
      className={`slot-class-constraint-indicator is-${side}`}
      aria-label={`Allowed classes and subclasses: ${description}`}
      title={description}
      style={{
        position: 'absolute',
        zIndex: 8,
        top: 7,
        ...(side === 'left' ? { left: 7 } : { right: 7 }),
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: 'max-content',
        maxWidth: 'calc(100% - 14px)',
        pointerEvents: 'none',
      }}
    >
      {visible.map(({ operatorClass, subclassNames }) => (
        <span
          key={operatorClass}
          className={`slot-class-constraint-item${subclassNames.length > 0 ? ' is-subfiltered' : ''}`}
          style={{
            position: 'relative',
            display: 'grid',
            width: 28,
            height: 28,
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <ClassIcon operatorClass={operatorClass} className="slot-class-constraint-icon" />
          {subclassNames.length > 0 && (
            <span
              className="slot-class-constraint-subcount"
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                display: 'grid',
                minWidth: 15,
                height: 15,
                padding: '0 3px',
                placeItems: 'center',
                border: '1px solid #8b6a2d',
                borderRadius: 999,
                color: '#17120a',
                background: '#f0c66d',
                boxShadow: '0 1px 5px rgba(0, 0, 0, 0.45)',
                fontSize: '0.48rem',
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {subclassNames.length}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="slot-class-constraint-overflow"
          aria-hidden="true"
          style={{
            display: 'grid',
            minWidth: 28,
            height: 28,
            padding: '0 5px',
            placeItems: 'center',
            border: '1px solid rgba(255, 255, 255, 0.26)',
            borderRadius: 6,
            color: '#e8e8eb',
            background: 'rgba(12, 12, 14, 0.86)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            fontSize: '0.58rem',
            fontWeight: 900,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
