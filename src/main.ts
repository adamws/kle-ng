import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/bootstrap-custom.scss'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { restoreReturnUrl } from './utils/auth-return-url'

// Put back the URL fragment that an OAuth redirect dropped, before anything reads the
// location. The keyboard store picks up #share= / #url= / #gist= during its normal
// startup, so it needs no knowledge of auth. No-op unless this is an OAuth callback.
restoreReturnUrl()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

app.mount('#app')

// Expose pinia instance for debug utilities in development mode
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__PINIA__ = pinia
}
