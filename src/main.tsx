import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Garder ce taux bas en production pour limiter le volume/coût
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  })
} else if (import.meta.env.PROD) {
  console.warn('VITE_SENTRY_DSN non défini : le suivi des erreurs Sentry est désactivé.')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Une erreur est survenue. L'équipe a été notifiée.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
