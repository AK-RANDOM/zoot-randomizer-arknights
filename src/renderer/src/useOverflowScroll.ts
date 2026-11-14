import { useEffect, useRef } from 'react'

export default function useOverflowScroll<Viewport extends HTMLElement>(value: string, enabled = true) {
  const viewportRef = useRef<Viewport>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const text = textRef.current
    if (!enabled || !viewport || !text) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pauseMs = 2500
    const pixelsPerSecond = 30
    let animation: Animation | undefined
    let distance = 0

    const measure = (): void => {
      const overflow = Math.max(0, text.scrollWidth - viewport.clientWidth)
      const nextDistance = reducedMotion.matches ? 0 : overflow
      if (nextDistance === distance) return
      distance = nextDistance
      animation?.cancel()
      if (distance === 0) return

      const travelMs = (distance / pixelsPerSecond) * 1000
      const duration = 2 * (pauseMs + travelMs)
      const start = 'translateX(0)'
      const end = `translateX(-${distance}px)`
      animation = text.animate(
        [
          { transform: start, offset: 0 },
          { transform: start, offset: pauseMs / duration },
          { transform: end, offset: (pauseMs + travelMs) / duration },
          { transform: end, offset: (2 * pauseMs + travelMs) / duration },
          { transform: start, offset: 1 },
        ],
        { duration, easing: 'linear', iterations: Infinity },
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(text)

    reducedMotion.addEventListener('change', measure)

    return () => {
      observer.disconnect()
      reducedMotion.removeEventListener('change', measure)
      animation?.cancel()
    }
  }, [value, enabled])

  return { viewportRef, textRef }
}
