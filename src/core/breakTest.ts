export type BreakTestBands = {
  leadership: number
  lostBy: number
  modifiedThreshold: number
  giveGround: string
  fallBack: string
  breakAndFlee: string
}

function clampLeadership(value: number) {
  const parsed = Math.floor(Number(value || 0))
  return Math.max(2, Math.min(12, Number.isFinite(parsed) ? parsed : 2))
}

export function breakTestBands(leadershipValue: number, lostByValue: number): BreakTestBands {
  const leadership = clampLeadership(leadershipValue)
  const lostBy = Math.max(0, Math.floor(Number(lostByValue || 0)))
  const modifiedThreshold = leadership - lostBy

  const giveGround = modifiedThreshold >= 2
    ? `Natural 2D6 total ${modifiedThreshold === 2 ? '2' : `2–${Math.min(12, modifiedThreshold)}`}; natural double 1 always Gives Ground.`
    : 'Natural double 1 only.'

  const fallBackMin = Math.max(2, modifiedThreshold + 1)
  const fallBack = fallBackMin <= leadership
    ? `Natural 2D6 total ${fallBackMin === leadership ? `${leadership}` : `${fallBackMin}–${leadership}`} (except natural double 1).`
    : 'No ordinary 2D6 total produces this result.'

  const breakMin = leadership + 1
  const breakAndFlee = breakMin <= 12
    ? `Natural 2D6 total ${breakMin === 12 ? '12' : `${breakMin}–12`}.`
    : 'No natural 2D6 total produces this result.'

  return { leadership, lostBy, modifiedThreshold, giveGround, fallBack, breakAndFlee }
}
