function normalizedText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
}

const chromePatterns = [
  /^URL Copied!?$/i,
  /^Cross-Reference Links$/i,
  /^(?:Previous|Next)\s*(?:-|–|—|:)/i,
  /^Switch Index/i,
  /^Back(?: Source)?$/i,
  /^Source\s*:/i,
  /^Last update\s*:/i,
  /^Table of Contents$/i,
  /^Current Version\b/i,
  /^If the page is (?:still )?not loading properly/i,
  /^Please verify the URL in the address bar/i,
  /^If it persists, please help by using the [“"]?Bug Report/i,
  /^(?:Ravening Hordes|Forces of Fantasy|Arcane Journal|Warhammer: The Old World|Legacy Army List)\b.*(?:p\.|page)\s*\d+/i,
]

const mechanicalOpeners = /^(?:single use\.?|once per|during|at the (?:start|end)|when|whenever|if |unless |after |before |a model|models? |this model|this weapon|the weapon|this item|the bearer|the wearer|the wielder|the unit|units? |a character|the character|characters? |enemy |friendly |notes?:)/i
const mechanicalTerms = /\b(?:may|must|can(?:not|'t)?|cannot|gains?|loses?|suffers?|inflicts?|causes?|cause|counts as|re-?roll|modifier|characteristic|armour piercing|ward save|armour save|regeneration|leadership test|characteristic test|charge|charged|combat|shooting|attack|attacks|roll|rolls|wound|wounds|initiative|movement|weapon skill|ballistic skill|strength|toughness|leadership|turn|phase|range|within|until|instead|fear|terror|panic|special rule|natural [1-6]|ap\b|to hit|to wound|save roll|unit strength|rank bonus|deploy|deployed|deployment|reserve|reinforcement|scout|vanguard|ambush)\b/i
const numericTerms = /(?:\bD[36]\b|[+-]\s*D?[1-9]|\b[1-6]\+\b|\bnatural [1-6]\b|\b\d+\s*(?:"|inches?|models?|wounds?|points?)\b)/i
const metadataTerms = /^(?:last update|publication|source|page|warhammer: the old world|ravening hordes|forces of fantasy|arcane journal|legacy army list|table of contents)\b/i
const transportErrorTerms = /(?:page is (?:still )?not loading properly|verify the URL in the address bar|Bug Report feature in the footer)/i

function mechanicalScore(value: string) {
  let score = 0
  if (mechanicalOpeners.test(value)) score += 5
  if (mechanicalTerms.test(value)) score += 3
  if (numericTerms.test(value)) score += 3
  if (/\b(?:special rule|magic weapon|magic armour|non-magical|the bearer|the wearer|the wielder|the model|this unit|models? with this)\b/i.test(value)) score += 2
  if (metadataTerms.test(value) || transportErrorTerms.test(value)) score -= 10
  if (/^[^.!?]{0,55}[.!?]?$/.test(value) && !mechanicalOpeners.test(value) && !numericTerms.test(value)) score -= 1
  return score
}

function sourceContentRoot(dom: Document) {
  return dom.querySelector<HTMLElement>('section.rule-description, .rule-description, main article, article, main') || dom.body
}

function semanticBlocks(dom: Document) {
  const root = sourceContentRoot(dom)
  const preferredSelectors = [
    'section.rule-description p, section.rule-description li',
    '.rule-description p, .rule-description li',
    'article section p, article section li',
    'article p, article li',
  ]
  for (const selector of preferredSelectors) {
    const rows = Array.from(dom.querySelectorAll<HTMLElement>(selector))
      .filter((node) => !node.closest('nav,footer,.metadata'))
      .map((node) => normalizedText(node.textContent || ''))
      .filter(Boolean)
    if (rows.some((row) => mechanicalScore(row) >= 2)) return rows
  }

  const primary = Array.from(root.querySelectorAll<HTMLElement>('p, li'))
    .filter((node) => !node.closest('nav,footer,.metadata'))
    .map((node) => normalizedText(node.textContent || ''))
    .filter(Boolean)
  if (primary.length) return primary

  return Array.from(root.querySelectorAll<HTMLElement>('div, section'))
    .filter((node) => !node.querySelector('table, ul, ol, h1, h2, h3, h4, h5, h6'))
    .map((node) => normalizedText(node.textContent || ''))
    .filter(Boolean)
}

const redundancyStopWords = new Set([
  'a', 'an', 'and', 'army', 'as', 'at', 'be', 'each', 'every', 'for', 'has', 'have', 'in', 'include', 'includes',
  'included', 'it', 'must', 'of', 'one', 'or', 'the', 'to', 'vice', 'versa', 'with', 'your', 'also',
])

function distinctiveTokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((token) => token.length > 2 && !redundancyStopWords.has(token)))
}

function removeRedundantSentences(rows: string[]) {
  const accepted: string[] = []
  let viceVersaAnchor: Set<string> | null = null
  for (const row of rows) {
    const normalized = normalizedText(row)
    if (!normalized) continue
    const exact = normalized.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (accepted.some((existing) => existing.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === exact)) continue

    const tokens = distinctiveTokens(normalized)
    if (viceVersaAnchor && /\b(?:must|for each|for every|include|includes)\b/i.test(normalized)) {
      const overlap = [...viceVersaAnchor].filter((token) => tokens.has(token)).length
      if (viceVersaAnchor.size >= 3 && overlap / viceVersaAnchor.size >= .75) continue
    }

    accepted.push(normalized)
    if (/\band vice versa\b/i.test(normalized)) viceVersaAnchor = tokens
  }
  return accepted
}

function cleanSourceNoise(value: string) {
  return normalizedText(value)
    .replace(/\bLast update:\s*\d{4}\s+[A-Za-z]+\s+\d{1,2}\b/gi, ' ')
    .replace(/\b(?:Rulebook|Ravening Hordes|Forces of Fantasy|Arcane Journal(?::[^.]+)?|Legacy Army List(?::[^.]+)?)(?:,?\s*(?:p\.|page))?\s*\d+\b/gi, ' ')
    .replace(/\bWarhammer: The Old World Online Rules Index\b/gi, ' ')
    .replace(/\bBack Source:\s*/gi, ' ')
    .replace(/\bURL Copied!?\b/gi, ' ')
    .replace(/\bTable of Contents\b/gi, ' ')
    .replace(/If the page is (?:still )?not loading properly[^.]*\.?/gi, ' ')
    .replace(/Please verify the URL in the address bar[^.]*\.?/gi, ' ')
    .replace(/If it persists, please help by using the [“"]?Bug Report[^.]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentenceCandidates(value: string) {
  const clean = cleanSourceNoise(value)
  if (!clean) return []
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean]
  return parts.map((part) => normalizedText(part).replace(/^Notes?:\s*/i, '')).filter((text) => text.length >= 8)
}

export function extractMechanicalRuleTextFromPlainText(value: string) {
  const blocks = removeRedundantSentences(sentenceCandidates(value)
    .filter((text) => text && !chromePatterns.some((pattern) => pattern.test(text)) && !metadataTerms.test(text) && !transportErrorTerms.test(text)))
  if (!blocks.length) return ''

  const scores = blocks.map(mechanicalScore)
  const strongIndexes = scores.map((score, index) => ({ score, index })).filter((row) => row.score >= 5).map((row) => row.index)
  if (!strongIndexes.length) return blocks.length === 1 && mechanicalScore(blocks[0]) > 0 ? blocks[0] : ''

  const firstMechanical = strongIndexes[0]
  const chosen = blocks.filter((text, index) => index >= firstMechanical && mechanicalScore(text) >= 2)
  return chosen.join(' ').replace(/\s+/g, ' ').trim()
}

export function extractMechanicalRuleText(html: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,footer,.metadata').forEach((node) => node.remove())
  const blocks = semanticBlocks(dom)
    .filter((text) => text && !chromePatterns.some((pattern) => pattern.test(text)) && !transportErrorTerms.test(text))
    .filter((text, index, rows) => rows.indexOf(text) === index)
  return extractMechanicalRuleTextFromPlainText(blocks.join('. '))
}
