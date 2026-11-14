import type { Operator } from '../../shared/operator'
import { useOperatorAppearanceAvatar } from './operatorAppearance'

export default function CompactOperatorAvatar({
  operator,
}: {
  operator: Operator
}): React.JSX.Element {
  const { imageUrl } = useOperatorAppearanceAvatar(operator)

  return (
    <span
      className="release-representative draft-history__operator-icon"
      data-rarity={operator.rarity}
      title={`${operator.name} — ${operator.rarity}★`}
      aria-label={`${operator.name}, ${operator.rarity} star`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span aria-hidden="true">{operator.name.slice(0, 1)}</span>
      )}
    </span>
  )
}
