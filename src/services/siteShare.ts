export type ShareSiteResult = { ok: boolean; message: string }

export const OLDDEX_DISCORD_URL = 'https://discord.gg/NHf3YdueHE'

function oldDexUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export async function shareOldDex(): Promise<ShareSiteResult> {
  const url = oldDexUrl()
  const data = { title: 'Old.dex', text: 'Old.dex — Warhammer: The Old World companion', url }
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(data)
      return { ok: true, message: 'Share sheet opened.' }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return { ok: true, message: 'Old.dex link copied.' }
    }
    if (typeof window !== 'undefined') {
      window.prompt('Copy this Old.dex link:', url)
      return { ok: true, message: 'Old.dex link ready to copy.' }
    }
    return { ok: false, message: 'Sharing is not available in this browser.' }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { ok: false, message: 'Share cancelled.' }
    return { ok: false, message: 'Could not share Old.dex from this browser.' }
  }
}
