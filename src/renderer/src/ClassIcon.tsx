import { useEffect, useState } from 'react'
import type { OperatorClass } from '../../shared/operator'
import { CLASS_ICON_FILES } from '../../shared/operatorAssets'
import { bundledIconUrl } from './bundledIcons'
import simpleCaster from './assets/class-icon/caster.png'
import simpleDefender from './assets/class-icon/defender.png'
import simpleGuard from './assets/class-icon/guard.png'
import simpleMedic from './assets/class-icon/medic.png'
import simpleSniper from './assets/class-icon/sniper.png'
import simpleSpecialist from './assets/class-icon/specialist.png'
import simpleSupporter from './assets/class-icon/supporter.png'
import simpleVanguard from './assets/class-icon/vanguard.png'

const simpleClassIcons: Record<OperatorClass, string> = {
  Caster: simpleCaster,
  Defender: simpleDefender,
  Guard: simpleGuard,
  Medic: simpleMedic,
  Sniper: simpleSniper,
  Specialist: simpleSpecialist,
  Supporter: simpleSupporter,
  Vanguard: simpleVanguard,
}

interface ClassIconProps {
  operatorClass: OperatorClass
  className?: string
  variant?: 'simple' | 'regular'
}

export default function ClassIcon({
  operatorClass,
  className = '',
  variant = 'regular',
}: ClassIconProps): React.JSX.Element {
  const bundledUrl =
    variant === 'simple'
      ? simpleClassIcons[operatorClass]
      : bundledIconUrl('class-icons', CLASS_ICON_FILES[operatorClass])
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const imageUrl = bundledUrl ?? fallbackUrl

  useEffect(() => {
    let active = true
    if (bundledUrl) return
    setFallbackUrl(null)

    void window.desktop.getClassIcon(operatorClass).then((url) => {
      if (active) setFallbackUrl(url)
    })

    return () => {
      active = false
    }
  }, [bundledUrl, operatorClass])

  return (
    <span
      className={`class-icon ${className}`.trim()}
      title={operatorClass}
      aria-label={operatorClass}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : (
        <span className="class-icon__fallback" aria-hidden="true">
          {operatorClass.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}
