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
  const operatorById = new Map(reservation.operators.map((operator) => [operator.id, operator]))
  const reservedAlterGroups = new Set<string>()
  if (reservation.constraints.alterExclusivity) {
    for (const operatorId of reservedOperatorIds) {
      const alterGroup = operatorById.get(operatorId)?.alterGroup
      if (alterGroup) reservedAlterGroups.add(alterGroup)
    }
  }

  return options.map((option) => {
    const exactReserved = reservedOperatorIds.has(option.operator.id)
    const alterReserved = Boolean(
      reservation.constraints.alterExclusivity &&
      option.operator.alterGroup &&
      reservedAlterGroups.has(option.operator.alterGroup),
    )
    if (!exactReserved && !alterReserved) return option
    const reason = exactReserved
      ? 'Already picked in another slot'
      : 'Alter of an operator picked in another slot'
    return {
      ...option,
      disabled: true,
      disabledReason: [option.disabledReason, reason].filter(Boolean).join(' · '),
    }
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
