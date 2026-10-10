import type { ComponentProps } from 'react'
import SquadConstraintEditorBase, { resolveSlotClassClick } from './SquadConstraintEditorBase'
import { SlotConstraintReservationProvider } from './SlotConstraintReservationContext'

export { resolveSlotClassClick }

type SquadConstraintEditorProps = ComponentProps<typeof SquadConstraintEditorBase>

export default function SquadConstraintEditor(
  props: SquadConstraintEditorProps,
): React.JSX.Element {
  return (
    <SlotConstraintReservationProvider
      value={{
        slotIndex: props.slotIndex,
        constraints: props.constraints,
        operators: props.operators,
      }}
    >
      <SquadConstraintEditorBase {...props} />
    </SlotConstraintReservationProvider>
  )
}
