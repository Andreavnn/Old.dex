import { readStorage, writeStorage } from './storage'

const WELCOME_KEY = 'olddex.welcome.seen.v1'
const INSTALL_PROMPT_DISMISSED_KEY = 'olddex.install-prompt.dismissed.v1'

export function hasSeenWelcome() {
  return readStorage(WELCOME_KEY) === '1'
}

export function markWelcomeSeen() {
  writeStorage(WELCOME_KEY, '1')
}

export function hasDismissedWelcomeInstallPrompt() {
  return readStorage(INSTALL_PROMPT_DISMISSED_KEY) === '1'
}

export function dismissWelcomeInstallPromptPermanently() {
  writeStorage(INSTALL_PROMPT_DISMISSED_KEY, '1')
}
