import { useEffect, useState } from 'react'
import type { Operator } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import { useOperatorArtworkPreference } from './presentationPreferences'

interface OperatorCardProps {
  operator: Operator
}

export default function OperatorCard({
  operator,
}: OperatorCardProps): React.JSX.Element {
  const artworkPreference = useOperatorArtworkPreference()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [usingPortrait, setUsingPortrait] = useState(false)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    setUsingPortrait(false)

    void window.desktop
      .getOperatorPortrait(operator.id, artworkPreference)
      .then(async (portraitUrl) => {
        if (!active) return
        if (portraitUrl) {
          setUsingPortrait(true)
          setImageUrl(portraitUrl)
          return
        }

        const avatarUrl = await window.desktop.getOperatorImage(operator.id)
        if (active) {
          setUsingPortrait(false)
          setImageUrl(avatarUrl)
        }
      })
      .catch(async () => {
        const avatarUrl = await window.desktop.getOperatorImage(operator.id)
        if (active) {
          setUsingPortrait(false)
          setImageUrl(avatarUrl)
        }
      })

    return () => {
      active = false
    }
  }, [artworkPreference, operator.id])

  return (
    <article
      className="operator-card operator-card--portrait"
      data-rarity={operator.rarity}
      data-artwork={artworkPreference}
      title={`${operator.name} — ${artworkPreference.toUpperCase()} artwork`}
    >
      <div className="operator-card__art">
        {imageUrl ? (
          <img
            key={`${operator.id}:${artworkPreference}:${usingPortrait ? 'portrait' : 'avatar'}`}
            className={usingPortrait ? 'is-portrait' : 'is-avatar-fallback'}
            src={imageUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <div className="operator-card__fallback" aria-hidden="true">
            {operator.name.slice(0, 1)}
          </div>
        )}
      </div>

      <ClassIcon operatorClass={operator.class} className="operator-card__class-icon" />

      <div className="operator-card__caption">
        <strong>{operator.name}</strong>
        <span className="operator-card__rarity" aria-label={`${operator.rarity} star`}>
          {'★'.repeat(operator.rarity)}
        </span>
      </div>
    </article>
  )
}
