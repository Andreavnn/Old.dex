export type RuleTitleParts = { title: string; callout: string }

const minorTitleWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'via', 'vs', 'with'])

/**
 * Split a sentence-like trailing qualifier from a rule name while preserving
 * official numeric/dice/subtype parameters such as Armoured Hide (1),
 * Regeneration (5+) and Impact Hits (D6).
 */
export function splitRuleCallout(value: string): RuleTitleParts {
  const raw = String(value || '').trim()
  const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  if (!match) return { title: raw, callout: '' }

  const callout = match[2].trim()
  const sentenceLike = /\b(?:apply|applies|does|doesn['’]?t|does not|only|except|unless|when|while|if|against|mount|model|unit|rider|crew|character)\b/i.test(callout)
  return sentenceLike ? { title: match[1].trim(), callout } : { title: raw, callout: '' }
}

export function ruleDisplayName(value: string) {
  return splitRuleCallout(value).title
}

export function ruleCalloutLabel(value: string) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  return words.map((word, index) => {
    const lower = word.toLowerCase()
    if (index > 0 && minorTitleWords.has(lower)) return lower
    return lower.replace(/(^|[-/])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
  }).join(' ')
}
