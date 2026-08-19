import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './app/store'
import { ToastProvider } from './components/ui/Toast'
import { SocketProvider } from './contexts/SocketContext'
import App from './app/App'
import './index.css'

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('sparkcrm_theme') || 'dark'
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <SocketProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SocketProvider>
    </Provider>
  </StrictMode>
)
