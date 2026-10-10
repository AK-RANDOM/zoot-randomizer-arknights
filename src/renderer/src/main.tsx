import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './DraftPanel.css'
import './GlobalPoolFeature.css'
import './StandardSquadFeature.css'
import './StandardSquadLayoutOverrides.css'
import './PresentationPreferences.css'
import './RendererTheme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
