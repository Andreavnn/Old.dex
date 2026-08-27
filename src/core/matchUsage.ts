export type MatchUseScope = 'battle' | 'round' | 'turn'

export type MatchUseLimit = {
  scope: MatchUseScope
  limit: number
}

const wordNumbers: Record<string, number> = {
  once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6,
}

function numericWord(value: string) {
  const clean = String(value || '').toLowerCase().trim()
  const numeric = Number(clean)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  return wordNumbers[clean] || 0
}

export function extractMatchUseLimit(text: string, quantity = 1): MatchUseLimit | undefined {
  const source = String(text || '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
  if (!source) return undefined

  const scoped = source.match(/\b(once|twice|one|two|three|four|five|six|\d+)\s+(?:times?\s+)?per\s+(game|battle|round|turn)\b/i)
    || source.match(/\b(?:may|can)\s+be\s+used\s+(once|twice|one|two|three|four|five|six|\d+)\s+(?:times?\s+)?per\s+(game|battle|round|turn)\b/i)
  if (scoped) {
    const scope: MatchUseScope = /round/i.test(scoped[2]) ? 'round' : /turn/i.test(scoped[2]) ? 'turn' : 'battle'
    return { scope, limit: Math.max(1, numericWord(scoped[1])) * Math.max(1, Math.floor(Number(quantity || 1))) }
  }

  if (/\bonce per (?:game|battle)\b/i.test(source)) return { scope: 'battle', limit: Math.max(1, Math.floor(Number(quantity || 1))) }
  if (/\bonce per round\b/i.test(source)) return { scope: 'round', limit: Math.max(1, Math.floor(Number(quantity || 1))) }
  if (/\bonce per turn\b/i.test(source)) return { scope: 'turn', limit: Math.max(1, Math.floor(Number(quantity || 1))) }
  if (/\b(?:one|single)[ -]?use(?: only)?\b|\bone use only\b|\bmay be used once\b/i.test(source)) return { scope: 'battle', limit: Math.max(1, Math.floor(Number(quantity || 1))) }

  const finite = source.match(/\b(?:may|can)\s+be\s+used\s+(once|twice|one|two|three|four|five|six|\d+)\s+times?\b/i)
    || source.match(/\bup to\s+(one|two|three|four|five|six|\d+)\s+times?\b/i)
  if (finite) return { scope: 'battle', limit: Math.max(1, numericWord(finite[1])) * Math.max(1, Math.floor(Number(quantity || 1))) }

  return undefined
}

export function matchUseBucket(scope: MatchUseScope, round: number, side: 'player' | 'opponent') {
  if (scope === 'battle') return 'battle'
  if (scope === 'round') return `round:${Math.max(1, Math.floor(Number(round || 1)))}`
  return `turn:${Math.max(1, Math.floor(Number(round || 1)))}:${side}`
}
