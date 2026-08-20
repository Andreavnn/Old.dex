const WELCOME_KEY = 'olddex.welcome.seen.v1'

export function hasSeenWelcome() {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(WELCOME_KEY) === '1' } catch { return false }
}

export function markWelcomeSeen() {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(WELCOME_KEY, '1') } catch { /* continue without persistence */ }
}
