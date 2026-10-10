import type { ComponentProps } from 'react'
import SquadConstraintEditorBase from './SquadConstraintEditorBase'
import { SlotConstraintReservationProvider } from './SlotConstraintReservationContext'

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
