import type { CSSProperties } from 'react'
import ClassIcon from './ClassIcon'
import OperatorCard from './OperatorCard'
import type { SlotConstraint } from '../../shared/constraints'
import type { Operator, OperatorClass, OperatorRarity } from '../../shared/operator'
import { operatorMatchesSlotConstraint } from '../../shared/randomizer'
import './LockedSlotCard.css'

const AMIYA_MANDATORY_GROUP = 'amiya-forms'
const AMIYA_CLASS_ORDER: readonly OperatorClass[] = ['Caster', 'Guard', 'Medic']

export interface LockedSlotPresentation {
  operator: Operator
  classes: OperatorClass[]
  rarities: OperatorRarity[]
}

function amiyaClassOrder(operatorClass: OperatorClass): number {
  const index = AMIYA_CLASS_ORDER.indexOf(operatorClass)
  return index < 0 ? AMIYA_CLASS_ORDER.length : index
}

function sortAmiyaForms(forms: readonly Operator[]): Operator[] {
  return [...forms].sort(
    (left, right) => amiyaClassOrder(left.class) - amiyaClassOrder(right.class),
  )
}

export function lockedSlotPresentation(
  constraint: SlotConstraint,
  operators: readonly Operator[],
): LockedSlotPresentation | null {
  if (constraint.operatorId) {
    const operator = operators.find((candidate) => candidate.id === constraint.operatorId)
    return operator && operatorMatchesSlotConstraint(operator, constraint)
      ? { operator, classes: [operator.class], rarities: [...constraint.rarities] }
      : null
  }

  const group = constraint.mandatoryExclusivityGroup
  if (!group) return null

  const groupOperators = operators.filter(
    (operator) => operator.mandatoryExclusivityGroup === group,
  )
  const candidates = groupOperators
    .filter((operator) => operatorMatchesSlotConstraint(operator, constraint))
    .sort((left, right) => {
      if (group === AMIYA_MANDATORY_GROUP) {
        return amiyaClassOrder(left.class) - amiyaClassOrder(right.class)
      }
      return left.name.localeCompare(right.name)
    })

  if (candidates.length === 0) return null

  const classes = [...new Set(candidates.map((operator) => operator.class))]
  if (group === AMIYA_MANDATORY_GROUP) {
    classes.sort((left, right) => amiyaClassOrder(left) - amiyaClassOrder(right))
    const amiyaForms = sortAmiyaForms(groupOperators)
    const operator =
      classes.length === 1
        ? (candidates.find((candidate) => candidate.class === classes[0]) ?? candidates[0])
        : (amiyaForms.find((candidate) => candidate.class === 'Caster') ?? candidates[0])
    return { operator, classes, rarities: [...constraint.rarities] }
  }

  return { operator: candidates[0], classes, rarities: [...constraint.rarities] }
}

function lockedSlotBorderStyle(rarities: readonly OperatorRarity[]): CSSProperties | undefined {
  if (rarities.length === 0) return undefined
  const sorted = [...new Set(rarities)].sort((left, right) => right - left)
  const colors = sorted.map((rarity) => `var(--rarity-${rarity})`)
  const gradient =
    colors.length === 1
      ? `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`
      : `linear-gradient(135deg, ${colors.join(', ')})`
  return { '--slot-constraint-gradient': gradient } as CSSProperties
}

export default function LockedSlotCard({
  presentation,
  slot,
  onClick,
}: {
  presentation: LockedSlotPresentation
  slot: number
  onClick: () => void
}): React.JSX.Element {
  const multipleClasses = presentation.classes.length > 1
  return (
    <button
      type="button"
      className={`slot-locked-card${multipleClasses ? ' is-multi-class' : ''}`}
      data-rarity={presentation.operator.rarity}
      style={lockedSlotBorderStyle(presentation.rarities)}
      aria-label={`Configure squad slot ${slot}, locked to ${presentation.operator.name}`}
      onClick={onClick}
    >
      <OperatorCard operator={presentation.operator} />
      <span className="slot-lock-indicator" title="Specific operator locked" aria-hidden="true">
        🔒
      </span>
      {multipleClasses && (
        <span
          className="slot-locked-class-stack"
          aria-label={`Eligible classes: ${presentation.classes.join(', ')}`}
        >
          {presentation.classes.map((operatorClass) => (
            <ClassIcon key={operatorClass} operatorClass={operatorClass} />
          ))}
        </span>
      )}
    </button>
  )
}
