import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installFieldAlerts } from './utils/fieldAlerts.js'
import { ToastProvider } from './context/ToastContext.jsx'

// Outline empty required fields in every form when it is submitted.
installFieldAlerts()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
