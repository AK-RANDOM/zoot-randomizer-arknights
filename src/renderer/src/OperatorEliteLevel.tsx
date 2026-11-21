import type { ImportedOperatorProgress } from '../../shared/arknightsAccount'
import elite0Icon from './assets/elite-icon/e0.webp'
import elite1Icon from './assets/elite-icon/e1.webp'
import elite2Icon from './assets/elite-icon/e2.webp'
import './OperatorEliteLevel.css'

const eliteIcons = [elite0Icon, elite1Icon, elite2Icon] as const

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
