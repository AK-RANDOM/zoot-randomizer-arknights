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

const rootElement = document.getElementById('root')!
if (__WEB_BUILD__) window.desktop ??= browserApi

if (!window.desktop) {
  rootElement.textContent = 'The Windows app could not start. Close it and try again.'
} else {
  const app = <App />
  createRoot(rootElement).render(
    <StrictMode>{__WEB_BUILD__ ? <WebWidthGate>{app}</WebWidthGate> : app}</StrictMode>,
  )
}
