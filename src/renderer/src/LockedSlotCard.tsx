import { useEffect, useState } from 'react'
import OperatorCard from './OperatorCard'
import SlotClassConstraintIndicator from './SlotClassConstraintIndicator'
import { slotConstraintFrameStyle } from './SlotConstraintFrame'
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

export default function LockedSlotCard({
  presentation,
  constraint,
  operators,
  slot,
  onClick,
}: {
  presentation: LockedSlotPresentation
  constraint: SlotConstraint
  operators: readonly Operator[]
  slot: number
  onClick: () => void
}): React.JSX.Element {
  const [animationKey, setAnimationKey] = useState(0)
  const showClassIndicator =
    presentation.classes.length > 1 || (constraint.subclasses?.length ?? 0) > 0

  useEffect(() => {
    const replayOnRandomize = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.squad-panel .randomize-button')) return
      setAnimationKey((current) => current + 1)
    }
    document.addEventListener('click', replayOnRandomize)
    return () => document.removeEventListener('click', replayOnRandomize)
  }, [])

  return (
    <button
      type="button"
      className={`slot-locked-card${showClassIndicator ? ' has-class-indicator' : ''}`}
      data-rarity={presentation.operator.rarity}
      style={slotConstraintFrameStyle(presentation.rarities, 'transparent')}
      aria-label={`Configure squad slot ${slot}, locked to ${presentation.operator.name}`}
      onClick={onClick}
    >
      <OperatorCard operator={presentation.operator} animationKey={animationKey} />
      {showClassIndicator && (
        <SlotClassConstraintIndicator
          constraint={constraint}
          operators={operators}
          classes={presentation.classes}
          side="left"
        />
      )}
    </button>
  )
}
