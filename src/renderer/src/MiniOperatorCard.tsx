import type { ReactNode } from 'react'
import type { Operator } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import useOverflowScroll from './useOverflowScroll'

/** Shared 90px square presentation. The host supplies semantics and actions. */
export default function MiniOperatorCard({
  operator,
  artwork,
  showName = true,
  scrollName = true,
}: {
  operator: Operator
  artwork: ReactNode
  showName?: boolean
  scrollName?: boolean
}): React.JSX.Element {
  const { viewportRef, textRef } = useOverflowScroll<HTMLSpanElement>(operator.name, scrollName)
  return (
    <>
      <div className="mini-operator-card__art">{artwork}</div>
      <ClassIcon
        operatorClass={operator.class}
        variant="simple"
        className="mini-operator-card__class"
      />
      {showName && (
        <span ref={viewportRef} className="mini-operator-card__name">
          <strong ref={textRef}>{operator.name}</strong>
        </span>
      )}
    </>
  )
}
