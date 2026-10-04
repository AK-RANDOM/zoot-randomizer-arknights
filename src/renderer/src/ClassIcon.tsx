import { useEffect, useState } from 'react'
import type { OperatorClass } from '../../shared/operator'

interface ClassIconProps {
  operatorClass: OperatorClass
  className?: string
}

export default function ClassIcon({
  operatorClass,
  className = '',
}: ClassIconProps): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)

    void window.desktop.getClassIcon(operatorClass).then((url) => {
      if (active) setImageUrl(url)
    })

    return () => {
      active = false
    }
  }, [operatorClass])

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
