import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { reportAppError } from './services/appErrors'
import { initializeInstallApp } from './services/installApp'
import './services/language'
import './styles.css'
import './styles-v033.css'
import './styles-v034.css'
import './styles-v035.css'
import './styles-v036.css'
import './styles-v037.css'
import './styles-v038.css'

initializeInstallApp()

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  reportAppError(error, 'VUE_RUNTIME_ERROR', { info })
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportAppError(event.error || event.message, 'WINDOW_RUNTIME_ERROR', { source: event.filename || 'window', line: event.lineno || 0 })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportAppError(event.reason, 'UNHANDLED_PROMISE_REJECTION')
  })

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        reportAppError(error, 'PWA_SERVICE_WORKER_REGISTRATION')
      })
    })
  }
}

app.use(router).mount('#app')
