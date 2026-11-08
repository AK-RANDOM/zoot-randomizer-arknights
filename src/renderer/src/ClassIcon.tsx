import { useEffect, useState } from 'react'
import type { OperatorClass } from '../../shared/operator'
import { CLASS_ICON_FILES } from '../../shared/operatorAssets'
import { bundledIconUrl } from './bundledIcons'

interface ClassIconProps {
  operatorClass: OperatorClass
  className?: string
}

export default function ClassIcon({
  operatorClass,
  className = '',
}: ClassIconProps): React.JSX.Element {
  const bundledUrl = bundledIconUrl('class-icons', CLASS_ICON_FILES[operatorClass])
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
