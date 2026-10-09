import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Operator } from '../../shared/operator'
import ClassIcon from './ClassIcon'
import { FactionIcon } from './FilterAssetIcon'
import { useOperatorArtworkPreference } from './presentationPreferences'
import './OperatorCard.css'

export interface OperatorCardInteractionLine {
  id: string
  label: string
  modifier: string
}

export interface OperatorCardInteractionDetails {
  baselineCost: number
  minimumCost: number
  maximumCost: number
  currentCost?: number
  interactions: readonly OperatorCardInteractionLine[]
}

interface OperatorCardProps {
  operator: Operator
  interactionDetails?: OperatorCardInteractionDetails
  variant?: 'standard' | 'draft-compact'
  topRightAdornment?: ReactNode
  overlay?: ReactNode
}

export default function OperatorCard({
  operator,
  interactionDetails,
  variant = 'standard',
  topRightAdornment,
  overlay,
}: OperatorCardProps): React.JSX.Element {
  const artworkPreference = useOperatorArtworkPreference()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [usingPortrait, setUsingPortrait] = useState(false)
  const interactionIndicatorRef = useRef<HTMLButtonElement | null>(null)
  const nameViewportRef = useRef<HTMLDivElement | null>(null)
  const nameTextRef = useRef<HTMLSpanElement | null>(null)
  const [nameOverflow, setNameOverflow] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState<{
    top?: number
    bottom?: number
    right: number
  } | null>(null)

  useEffect(() => {
    const viewport = nameViewportRef.current
    const text = nameTextRef.current
    if (!viewport || !text) return

    const measure = (): void => {
      setNameOverflow(Math.max(0, text.scrollWidth - viewport.clientWidth))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(text)

    return () => observer.disconnect()
  }, [operator.name])

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

  const hasInteractions = (interactionDetails?.interactions.length ?? 0) > 0
  const showInteractionTooltip = (): void => {
    const indicator = interactionIndicatorRef.current
    if (!indicator) return
    const rect = indicator.getBoundingClientRect()
    const tooltipWidth = Math.min(360, Math.max(0, window.innerWidth - 32))
    const maximumRight = Math.max(16, window.innerWidth - tooltipWidth - 16)
    const right = Math.min(Math.max(16, window.innerWidth - rect.right), maximumRight)
    if (rect.top > window.innerHeight / 2) {
      setTooltipPosition({ bottom: Math.max(16, window.innerHeight - rect.top + 6), right })
    } else {
      setTooltipPosition({ top: Math.max(16, rect.bottom + 6), right })
    }
  }

  return (
    <article
      className={`operator-card operator-card--portrait${variant === 'draft-compact' ? ' operator-card--draft-compact' : ''}`}
      data-rarity={operator.rarity}
      data-artwork={artworkPreference}
      title={`${operator.name} — ${artworkPreference.toUpperCase()} artwork`}
    >
      <div className="operator-card__art">
        {operator.faction.main && (
          <FactionIcon id={operator.faction.main} className="operator-card__faction-logo" />
        )}
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

      {topRightAdornment && (
        <div className="operator-card__top-right-adornment">{topRightAdornment}</div>
      )}

      {hasInteractions && interactionDetails && (
        <>
          <div className="operator-card__interaction-control">
            <button
              ref={interactionIndicatorRef}
              type="button"
              className="operator-card__interaction-indicator"
              aria-label={`Interactions affecting ${operator.name}`}
              onMouseEnter={showInteractionTooltip}
              onMouseLeave={() => setTooltipPosition(null)}
              onFocus={showInteractionTooltip}
              onBlur={() => setTooltipPosition(null)}
            >
              ↔
            </button>
          </div>
          {tooltipPosition &&
            createPortal(
              <div
                className="operator-card__interaction-tooltip"
                role="tooltip"
                style={{
                  top: tooltipPosition.top,
                  bottom: tooltipPosition.bottom,
                  right: tooltipPosition.right,
                }}
              >
                <strong>{operator.name}</strong>
                <dl>
                  <div>
                    <dt>Baseline Cost</dt>
                    <dd>{interactionDetails.baselineCost}</dd>
                  </div>
                  <div>
                    <dt>Minimum Possible Cost</dt>
                    <dd>{interactionDetails.minimumCost}</dd>
                  </div>
                  <div>
                    <dt>Maximum Possible Cost</dt>
                    <dd>{interactionDetails.maximumCost}</dd>
                  </div>
                  {interactionDetails.currentCost !== undefined && (
                    <div>
                      <dt>Current Cost</dt>
                      <dd>{interactionDetails.currentCost}</dd>
                    </div>
                  )}
                </dl>
                <div className="operator-card__interaction-list">
                  <span>Interactions affecting this operator:</span>
                  <ul>
                    {interactionDetails.interactions.map((interaction) => (
                      <li key={interaction.id}>
                        <span>{interaction.label}</span>
                        <strong>{interaction.modifier}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>,
              document.body,
            )}
        </>
      )}

      {overlay && <div className="operator-card__overlay">{overlay}</div>}

      <div className="operator-card__caption">
        <div
          ref={nameViewportRef}
          className={`operator-card__name-viewport${nameOverflow > 0 ? ' is-overflowing' : ''}`}
          style={{ '--operator-name-overflow': `${nameOverflow}px` } as CSSProperties}
        >
          <strong>
            <span ref={nameTextRef} className="operator-card__name-text">
              {operator.name}
            </span>
          </strong>
        </div>
        <span className="operator-card__rarity" aria-label={`${operator.rarity} star`}>
          {'★'.repeat(operator.rarity)}
        </span>
      </div>
    </article>
  )
}
