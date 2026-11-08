import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import WebWidthGate from './WebWidthGate'
import { browserApi } from './browserApi'
import './styles.css'
import './DraftPanel.css'
import './GarrisonSquadFeature.css'
import './GlobalPoolFeature.css'
import './StandardSquadFeature.css'
import './StandardSquadLayoutOverrides.css'
import './PresentationPreferences.css'
import './RendererTheme.css'

window.desktop ??= browserApi

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.desktop.platform === 'browser' ? (
      <WebWidthGate>
        <App />
      </WebWidthGate>
    ) : (
      <App />
    )}
  </StrictMode>,
)
