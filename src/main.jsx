import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // An older parent app cached every navigation, including /v2/. Refresh its
    // worker before installing ours so both versions keep their own offline page.
    try {
      const root = new URL('./', window.location.href).href
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.filter(registration => root.startsWith(registration.scope) && root !== registration.scope).map(registration => registration.update().catch(() => {})))
    } catch { /* The v2 worker can still be installed independently. */ }
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
