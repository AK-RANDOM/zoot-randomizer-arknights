import { useLayoutEffect, type RefObject } from 'react'

/** Measure at the selected size so shrinking cannot repeatedly toggle wrapping. */
export default function useWrappedOperatorName(
  viewportRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLSpanElement | null>,
  name: string,
  enabled: boolean,
): void {
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const text = textRef.current
    if (!viewport || !text) return
    if (!enabled) {
      delete text.dataset.wraps
      return
    }
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    const measure = (): void => {
      const style = getComputedStyle(text)
      const baseSize = parseFloat(style.getPropertyValue('--operator-card-name-size')) || 12
      context.font = `${style.fontStyle} ${style.fontWeight} ${baseSize}px ${style.fontFamily}`
      text.dataset.wraps = String(context.measureText(name).width > viewport.clientWidth + 0.5)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    // Also remeasure when typography or font loading changes.
    observer.observe(text)
    document.fonts.addEventListener('loadingdone', measure)
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', measure)
      delete text.dataset.wraps
    }
  }, [viewportRef, textRef, name, enabled])
}
