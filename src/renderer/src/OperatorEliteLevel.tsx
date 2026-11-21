import type { ImportedOperatorProgress } from '../../shared/arknightsAccount'
import elite0Icon from './assets/elite-icon/e0.webp'
import elite1Icon from './assets/elite-icon/e1.webp'
import elite2Icon from './assets/elite-icon/e2.webp'
import forfeitIcon from './assets/draft/forfeit-icon.png'
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
      {iconOnly ? (
        <span
          className="operator-elite-level__icon operator-elite-level__unowned-icon"
          style={{ maskImage: `url(${forfeitIcon})` }}
          aria-hidden="true"
        />
      ) : (
        <>
          <img className="operator-elite-level__icon" src={forfeitIcon} alt="" draggable={false} />
          <span>Not Owned</span>
        </>
      )}
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
