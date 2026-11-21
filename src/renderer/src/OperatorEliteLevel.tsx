import type { ImportedOperatorProgress } from '../../shared/arknightsAccount'
import elite0Icon from './assets/elite-icon/e0.webp'
import elite1Icon from './assets/elite-icon/e1.webp'
import elite2Icon from './assets/elite-icon/e2.webp'
import unavailableIcon from './assets/elite-icon/unavailable.webp'
import compactElite0Icon from './assets/elite-icon/compact/e0.webp'
import compactElite1Icon from './assets/elite-icon/compact/e1.webp'
import compactElite2Icon from './assets/elite-icon/compact/e2.webp'
import compactUnavailableIcon from './assets/elite-icon/compact/unavailable.webp'
import { useCompactProgressionIcons } from './ProgressionIconPreviewContext'
import './OperatorEliteLevel.css'

const eliteIcons = [elite0Icon, elite1Icon, elite2Icon] as const
const compactEliteIcons = [compactElite0Icon, compactElite1Icon, compactElite2Icon] as const

export function UnownedOperatorIndicator({
  iconOnly = false,
}: {
  iconOnly?: boolean
}): React.JSX.Element {
  const compact = useCompactProgressionIcons()
  return (
    <span
      className={`operator-elite-level is-unowned${compact ? ' is-compact' : ''}`}
      aria-label={iconOnly ? 'Not Owned' : undefined}
      title={iconOnly ? 'Not Owned' : undefined}
    >
      <span
        className="operator-elite-level__icon operator-elite-level__unowned-icon"
        style={{ maskImage: `url(${compact ? compactUnavailableIcon : unavailableIcon})` }}
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
  const compact = useCompactProgressionIcons()
  return (
    <span className={`operator-elite-level${compact ? ' is-compact' : ''}`}>
      <img
        className="operator-elite-level__icon"
        src={(compact ? compactEliteIcons : eliteIcons)[elite]}
        alt={`E${elite}`}
        draggable={false}
      />
      <span>{level}</span>
    </span>
  )
}
