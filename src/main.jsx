import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installGlobalErrorHandlers } from '@/lib/errorReporting'

installGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
