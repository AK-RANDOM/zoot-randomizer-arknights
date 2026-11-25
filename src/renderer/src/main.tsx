import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppDialogProvider } from './AppDialogs'
import { browserApi } from './browserApi'
import './styles.css'
import './DraftPanel.css'
import './GarrisonSquadFeature.css'
import './GlobalPoolFeature.css'
import './StandardSquadFeature.css'
import './StandardSquadLayoutOverrides.css'
import './PresentationPreferences.css'
import './RendererTheme.css'
import './StrongholdTheme.css'
import './ModeToolbar.css'
import './CompactDispatch.css'
import './OperatorCardLayout.css'
import './OperatorCardSurfaces.css'

const rootElement = document.getElementById('root')!
if (__WEB_BUILD__) window.desktop ??= browserApi

if (!window.desktop) {
  rootElement.textContent = 'The Windows app could not start. Close it and try again.'
} else {
  const app = (
    <AppDialogProvider>
      <App />
    </AppDialogProvider>
  )
  createRoot(rootElement).render(<StrictMode>{app}</StrictMode>)
}
