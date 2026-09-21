import { ConvexProvider } from 'convex/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DragonStatsAdmin } from './admin/DragonStatsAdmin.tsx'
import { convex } from './convexClient.ts'

// No router installed — this is the one hidden path this app recognizes,
// for filling in per-dragon base stats by hand. Not linked from the UI.
const isAdminRoute = window.location.pathname === '/admin/dragon-stats'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      {isAdminRoute ? <DragonStatsAdmin /> : <App />}
    </ConvexProvider>
  </StrictMode>,
)
