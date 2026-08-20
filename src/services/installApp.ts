import { computed, ref } from 'vue'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' | string }>
}

const promptEvent = ref<InstallPromptEvent | null>(null)
const installed = ref(false)
let initialized = false

function refreshInstalledState() {
  if (typeof window === 'undefined') return
  installed.value = Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )
}

function capturePrompt(event: Event) {
  event.preventDefault()
  promptEvent.value = event as InstallPromptEvent
}

function handleInstalled() {
  promptEvent.value = null
  installed.value = true
}

export function initializeInstallApp() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  refreshInstalledState()
  window.addEventListener('beforeinstallprompt', capturePrompt)
  window.addEventListener('appinstalled', handleInstalled)
}

export async function requestOldDexInstall() {
  initializeInstallApp()
  if (installed.value) return { outcome: 'installed' as const }
  const event = promptEvent.value
  if (!event) return { outcome: 'unavailable' as const }
  await event.prompt()
  const choice = await event.userChoice
  if (choice.outcome === 'accepted') promptEvent.value = null
  refreshInstalledState()
  return { outcome: choice.outcome }
}

export function useInstallApp() {
  initializeInstallApp()
  return {
    installPrompt: promptEvent,
    installedApp: installed,
    canInstall: computed(() => Boolean(promptEvent.value) && !installed.value),
    requestInstall: requestOldDexInstall,
    refreshInstalledState,
  }
}
