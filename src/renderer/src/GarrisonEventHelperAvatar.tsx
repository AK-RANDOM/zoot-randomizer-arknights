import { useEffect, useState } from 'react'
import type { Operator } from '../../shared/operator'

/** Fixed default E0 avatar. Do not subscribe to operator appearance preferences. */
export default function GarrisonEventHelperAvatar({
  operator,
}: {
  operator: Operator | null
}): React.JSX.Element {
  const [avatar, setAvatar] = useState<{ operatorId: string; url: string | null } | null>(null)
  useEffect(() => {
    let active = true
    if (operator) {
      // Despite its legacy 'e1' API spelling, the promotion-avatar service
      // explicitly selects defaultArts phase 0 (E0), or the default char ID.
      void window.desktop.getOperatorPromotionAvatar(operator.id, 'e1').then((url) => {
        if (active) setAvatar({ operatorId: operator.id, url })
      })
    }
    return () => {
      active = false
    }
  }, [operator?.id])

  const imageUrl = avatar?.operatorId === operator?.id ? (avatar?.url ?? null) : null

  return (
    <span
      className="garrison-event-helper-avatar"
      data-rarity={operator?.rarity ?? undefined}
      aria-label={operator ? `Event helper: ${operator.name}` : 'No event helper selected'}
      title={operator ? `${operator.name} · ${operator.rarity}★ event helper (E0)` : undefined}
    >
      {operator && imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : operator ? (
        <span aria-hidden="true">{operator.name.slice(0, 1)}</span>
      ) : null}
    </span>
  )
}
