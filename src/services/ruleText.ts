function normalizedText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

const chromePatterns = [
  /^URL Copied!?$/i,
  /^Cross-Reference Links$/i,
  /^(?:Previous|Next)\s*(?:-|–|—|:)/i,
  /^Switch Index/i,
  /^Back(?: Source)?$/i,
  /^Source\s*:/i,
]

const mechanicalOpeners = /^(?:single use\.?|once per|during|at the (?:start|end)|when|whenever|if |unless |after |before |a model|models? |this model|the bearer|the unit|units? |enemy |friendly )/i
const mechanicalTerms = /\b(?:may|must|can(?:not|'t)?|cannot|gains?|suffers?|inflicts?|re-?roll|modifier|characteristic|armour piercing|ward save|armour save|leadership test|characteristic test|charge|charged|combat|shooting|attack|attacks|roll|rolls|wound|wounds|initiative|movement|weapon skill|ballistic skill|strength|toughness|leadership|turn|phase|range|within|until|instead|natural [1-6])\b/i
const numericTerms = /(?:\bD[36]\b|[+-]\s*D?[1-9]|\b[1-6]\+\b|\bnatural [1-6]\b|\b\d+\s*(?:"|inches?|models?|wounds?)\b)/i

function mechanicalScore(value: string) {
  let score = 0
  if (mechanicalOpeners.test(value)) score += 5
  if (mechanicalTerms.test(value)) score += 3
  if (numericTerms.test(value)) score += 3
  if (/\b(?:special rule|magic weapon|non-magical|the bearer|the model|this unit)\b/i.test(value)) score += 2
  if (/^[^.!?]{0,55}[.!?]?$/.test(value) && !mechanicalOpeners.test(value) && !numericTerms.test(value)) score -= 1
  return score
}

function semanticBlocks(dom: Document) {
  const primary = Array.from(dom.querySelectorAll<HTMLElement>('p, li'))
    .map((node) => normalizedText(node.textContent || ''))
    .filter(Boolean)
  if (primary.length) return primary

  return Array.from(dom.querySelectorAll<HTMLElement>('main > div, main > section > div, article > div'))
    .filter((node) => !node.querySelector('table, ul, ol, h1, h2, h3, h4, h5, h6'))
    .map((node) => normalizedText(node.textContent || ''))
    .filter(Boolean)
}

export function extractMechanicalRuleText(html: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const blocks = semanticBlocks(dom)
    .filter((text) => text && !chromePatterns.some((pattern) => pattern.test(text)))
    .filter((text, index, rows) => rows.indexOf(text) === index)
  if (!blocks.length) return ''

  const scores = blocks.map(mechanicalScore)
  const strongIndexes = scores.map((score, index) => ({ score, index })).filter((row) => row.score >= 3).map((row) => row.index)
  if (!strongIndexes.length) return blocks.length === 1 ? blocks[0] : ''

  const firstMechanical = strongIndexes[0]
  const chosen = blocks.filter((text, index) => index >= firstMechanical && mechanicalScore(text) >= 2)
  return chosen.join(' ').replace(/\s+/g, ' ').trim()
}
