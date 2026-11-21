import { createContext, useContext, useState, type ReactNode } from 'react'
import './ProgressionIconPreview.css'

const CompactProgressionIconsContext = createContext(false)

export function useCompactProgressionIcons(): boolean {
  return useContext(CompactProgressionIconsContext)
}

export function ProgressionIconPreviewProvider({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  const enabled = import.meta.env.DEV || import.meta.env.VITE_PROGRESSION_ICON_TESTER === 'true'
  const [compact, setCompact] = useState(false)

  return (
    <CompactProgressionIconsContext.Provider value={enabled && compact}>
      {children}
      {enabled && (
        <aside className="progression-icon-preview" aria-label="Progression icon tester">
          <strong>Progression icon tester</strong>
          <span aria-live="polite">
            {compact ? 'Compact: 16px main / 12px square' : 'Original: 24px main / 18px square'}
          </span>
          <button type="button" aria-pressed={compact} onClick={() => setCompact(!compact)}>
            {compact ? 'Use original icons' : 'Use compact icons'}
          </button>
        </aside>
      )}
    </CompactProgressionIconsContext.Provider>
  )
}
