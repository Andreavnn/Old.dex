import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { reportAppError } from './services/appErrors'
import './styles.css'

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
}

app.use(router).mount('#app')
