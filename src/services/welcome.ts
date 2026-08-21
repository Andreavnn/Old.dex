const WELCOME_KEY = 'olddex.welcome.seen.v1'
const INSTALL_PROMPT_DISMISSED_KEY = 'olddex.install-prompt.dismissed.v1'

export function hasSeenWelcome() {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(WELCOME_KEY) === '1' } catch { return false }
}

export function markWelcomeSeen() {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(WELCOME_KEY, '1') } catch { /* continue without persistence */ }
}

export function hasDismissedWelcomeInstallPrompt() {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === '1' } catch { return false }
}

export function dismissWelcomeInstallPromptPermanently() {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1') } catch { /* continue without persistence */ }
}
