import { useId, useState, type ReactNode } from 'react'
import './DispatchSetupPanel.css'

type DispatchMode = 'standard' | 'draft' | 'garrison' | 'is-opening'

export default function DispatchSetupPanel({
  mode,
  summary,
  actions,
  secondaryActions,
  submenu,
  children,
}: {
  mode: DispatchMode
  summary: ReactNode
  actions: ReactNode
  secondaryActions?: ReactNode
  submenu?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const storageKey = `dispatch-setup-expanded:${mode}`
  const [expanded, setExpanded] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })
  const id = useId()
  const changeExpanded = (value: boolean): void => {
    setExpanded(value)
    try {
      sessionStorage.setItem(storageKey, String(value))
    } catch {
      // Expansion still works when browser storage is unavailable.
    }
  }

  return (
    <div className="dispatch-setup" data-mode={mode} data-expanded={expanded}>
      <div className="dispatch-setup__bar">
        <div className="dispatch-setup__heading">
          <div className="dispatch-setup__summary">{summary}</div>
        </div>
        <div className="dispatch-setup__actions">
          {secondaryActions && (
            <div className="dispatch-setup__secondary-actions">{secondaryActions}</div>
          )}
          <button
            type="button"
            className="secondary-button dispatch-setup__toggle"
            aria-expanded={expanded}
            aria-controls={`${id}-settings ${id}-submenu`}
            onClick={() => changeExpanded(!expanded)}
          >
            {expanded ? 'Hide setup' : 'Edit setup'}{' '}
            <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
          </button>
          {actions}
        </div>
      </div>
      <div className="dispatch-setup__settings" id={`${id}-settings`}>
        {children}
      </div>
      <div className="dispatch-setup__submenu" id={`${id}-submenu`}>
        {submenu}
      </div>
    </div>
  )
}
