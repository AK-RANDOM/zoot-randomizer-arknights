import { createContext, useContext, type ReactNode } from 'react'
import type { RandomizerConstraints } from '../../shared/constraints'
import type { Operator } from '../../shared/operator'

interface SlotConstraintReservationContextValue {
  slotIndex: number
  constraints: RandomizerConstraints
  operators: readonly Operator[]
}

const SlotConstraintReservationContext =
  createContext<SlotConstraintReservationContextValue | null>(null)

export function SlotConstraintReservationProvider({
  value,
  children,
}: {
  value: SlotConstraintReservationContextValue
  children: ReactNode
}): React.JSX.Element {
  return (
    <SlotConstraintReservationContext.Provider value={value}>
      {children}
    </SlotConstraintReservationContext.Provider>
  )
}

export function useSlotConstraintReservationContext(): SlotConstraintReservationContextValue | null {
  return useContext(SlotConstraintReservationContext)
}
