export type RuleTitleParts = { title: string; callout: string }

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
