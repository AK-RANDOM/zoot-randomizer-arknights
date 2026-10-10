import { useMemo, type ComponentProps } from 'react'
import OperatorSelectorBase, {
  OperatorMultiSelector,
  filterOperatorSelectorOptions,
  type OperatorSelectorOption,
} from './OperatorSelectorBase'
import { useSlotConstraintReservationContext } from './SlotConstraintReservationContext'

export { OperatorMultiSelector, filterOperatorSelectorOptions }
export type { OperatorSelectorOption }

type OperatorSelectorProps = ComponentProps<typeof OperatorSelectorBase>

export function filterReservedSlotOperatorOptions(
  options: readonly OperatorSelectorOption[],
  reservation: ReturnType<typeof useSlotConstraintReservationContext>,
): readonly OperatorSelectorOption[] {
  if (!reservation) return options

  const reservedOperatorIds = new Set(
    reservation.constraints.slots
      .filter((_, index) => index !== reservation.slotIndex)
      .map((slot) => slot.operatorId)
      .filter((operatorId): operatorId is string => Boolean(operatorId)),
  )
  if (reservedOperatorIds.size === 0) return options

  const operatorById = new Map(reservation.operators.map((operator) => [operator.id, operator]))
  const reservedAlterGroups = new Set<string>()
  if (reservation.constraints.alterExclusivity) {
    for (const operatorId of reservedOperatorIds) {
      const alterGroup = operatorById.get(operatorId)?.alterGroup
      if (alterGroup) reservedAlterGroups.add(alterGroup)
    }
  }

  return options.filter((option) => {
    if (reservedOperatorIds.has(option.operator.id)) return false
    return !(
      reservation.constraints.alterExclusivity &&
      option.operator.alterGroup &&
      reservedAlterGroups.has(option.operator.alterGroup)
    )
  })
}

export default function OperatorSelector(props: OperatorSelectorProps): React.JSX.Element {
  const reservation = useSlotConstraintReservationContext()
  const options = useMemo(
    () => filterReservedSlotOperatorOptions(props.options, reservation),
    [props.options, reservation],
  )

  return <OperatorSelectorBase {...props} options={options} />
}
