import type { ImportedOperatorProgress } from '../../shared/arknightsAccount'
import elite0Icon from './assets/elite-icon/compact/e0.webp'
import elite1Icon from './assets/elite-icon/compact/e1.webp'
import elite2Icon from './assets/elite-icon/compact/e2.webp'
import unavailableIcon from './assets/elite-icon/compact/unavailable.webp'
import './OperatorEliteLevel.css'

const eliteIcons = [elite0Icon, elite1Icon, elite2Icon] as const

export function UnownedOperatorIndicator({
  iconOnly = false,
}: {
  iconOnly?: boolean
}): React.JSX.Element {
  return (
    <span
      className="operator-elite-level is-unowned"
      aria-label={iconOnly ? 'Not Owned' : undefined}
      title={iconOnly ? 'Not Owned' : undefined}
    >
      <span
        className="operator-elite-level__icon operator-elite-level__unowned-icon"
        style={{ maskImage: `url(${unavailableIcon})` }}
        aria-hidden="true"
      />
      {!iconOnly && <span>Not Owned</span>}
    </span>
  )
}

export default function OperatorEliteLevel({
  elite,
  level,
}: Pick<ImportedOperatorProgress, 'elite' | 'level'>): React.JSX.Element {
  return (
    <span className="operator-elite-level">
      <img
        className="operator-elite-level__icon"
        src={eliteIcons[elite]}
        alt={`E${elite}`}
        draggable={false}
      />
      <span>{level}</span>
    </span>
  )
}
