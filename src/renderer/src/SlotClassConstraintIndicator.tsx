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
  const requestedClasses =
    classOverride && classOverride.length > 0
      ? [...classOverride]
      : constraint.classes.length > 0
        ? operatorClasses.filter((operatorClass) => constraint.classes.includes(operatorClass))
        : selectedSubclassIds.size > 0
          ? operatorClasses.filter((operatorClass) =>
              operators.some(
                (operator) =>
                  operator.class === operatorClass && selectedSubclassIds.has(operator.subclass.id),
              ),
            )
          : []

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
  side = 'left',
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
    >
      {visible.map(({ operatorClass, subclassNames }) => (
        <span
          key={operatorClass}
          className={`slot-class-constraint-item${subclassNames.length > 0 ? ' is-subfiltered' : ''}`}
        >
          <ClassIcon operatorClass={operatorClass} />
          {subclassNames.length > 0 && (
            <span className="slot-class-constraint-subcount" aria-hidden="true">
              {subclassNames.length}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="slot-class-constraint-overflow" aria-hidden="true">
          +{overflow}
        </span>
      )}
    </span>
  )
}
