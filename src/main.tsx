import { ConvexProvider } from 'convex/react'
import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DragonStatsAdmin } from './admin/DragonStatsAdmin.tsx'
import { SynergyRules } from './admin/SynergyRules.tsx'
import { convex } from './convexClient.ts'

// No router installed — these are the only hidden paths this app
// recognizes, for admin/review pages not linked from the UI.
const ADMIN_ROUTES: Record<string, () => ReactElement> = {
  '/admin/dragon-stats': DragonStatsAdmin,
  '/admin/synergy-rules': SynergyRules,
}
const Route = ADMIN_ROUTES[window.location.pathname]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      {Route ? <Route /> : <App />}
    </ConvexProvider>
  </StrictMode>,
)
