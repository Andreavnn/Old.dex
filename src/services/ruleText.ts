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
  /^Last update\s*:/i,
  /^(?:Ravening Hordes|Forces of Fantasy|Arcane Journal|Warhammer: The Old World|Legacy Army List)\b.*(?:p\.|page)\s*\d+/i,
]

const mechanicalOpeners = /^(?:single use\.?|once per|during|at the (?:start|end)|when|whenever|if |unless |after |before |a model|models? |this model|the bearer|the unit|units? |enemy |friendly )/i
const mechanicalTerms = /\b(?:may|must|can(?:not|'t)?|cannot|gains?|suffers?|inflicts?|causes?|cause|counts as|re-?roll|modifier|characteristic|armour piercing|ward save|armour save|leadership test|characteristic test|charge|charged|combat|shooting|attack|attacks|roll|rolls|wound|wounds|initiative|movement|weapon skill|ballistic skill|strength|toughness|leadership|turn|phase|range|within|until|instead|fear|terror|panic|special rule|natural [1-6])\b/i
const numericTerms = /(?:\bD[36]\b|[+-]\s*D?[1-9]|\b[1-6]\+\b|\bnatural [1-6]\b|\b\d+\s*(?:"|inches?|models?|wounds?)\b)/i
const metadataTerms = /^(?:last update|publication|source|page|warhammer: the old world|ravening hordes|forces of fantasy|arcane journal)\b/i

function mechanicalScore(value: string) {
  let score = 0
  if (mechanicalOpeners.test(value)) score += 5
  if (mechanicalTerms.test(value)) score += 3
  if (numericTerms.test(value)) score += 3
  if (/\b(?:special rule|magic weapon|non-magical|the bearer|the model|this unit|models? with this)\b/i.test(value)) score += 2
  if (metadataTerms.test(value)) score -= 8
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

function sentenceCandidates(value: string) {
  const clean = normalizedText(value)
    .replace(/\bLast update:\s*\d{4}\s+\w+\s+\d{1,2}\b/gi, ' ')
    .replace(/\b(?:Ravening Hordes|Forces of Fantasy|Arcane Journal:[^.]+|Legacy Army List:[^.]+),?\s*p\.\s*\d+\b/gi, ' ')
    .replace(/\bWarhammer: The Old World Online Rules Index\b/gi, ' ')
    .replace(/\bBack Source:\s*/gi, ' ')
    .replace(/\bURL Copied!?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return []

  // Some transport variants flatten the whole rule page into one paragraph. Split
  // that paragraph into sentence-sized candidates before applying the mechanical
  // score so flavour/source metadata cannot hitch a ride with the actual rule text.
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean]
  return parts.map(normalizedText).filter((text) => text.length >= 8)
}

export function extractMechanicalRuleTextFromPlainText(value: string) {
  const blocks = sentenceCandidates(value)
    .filter((text) => text && !chromePatterns.some((pattern) => pattern.test(text)) && !metadataTerms.test(text))
    .filter((text, index, rows) => rows.indexOf(text) === index)
  if (!blocks.length) return ''

  const scores = blocks.map(mechanicalScore)
  const strongIndexes = scores.map((score, index) => ({ score, index })).filter((row) => row.score >= 3).map((row) => row.index)
  if (!strongIndexes.length) return blocks.length === 1 && mechanicalScore(blocks[0]) > 0 ? blocks[0] : ''

  const firstMechanical = strongIndexes[0]
  const chosen = blocks.filter((text, index) => index >= firstMechanical && mechanicalScore(text) >= 2)
  return chosen.join(' ').replace(/\s+/g, ' ').trim()
}

export function extractMechanicalRuleText(html: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const blocks = semanticBlocks(dom)
    .filter((text) => text && !chromePatterns.some((pattern) => pattern.test(text)))
    .filter((text, index, rows) => rows.indexOf(text) === index)
  return extractMechanicalRuleTextFromPlainText(blocks.join('. '))
}
