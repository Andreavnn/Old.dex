import { fetchRuleDocument } from './ruleContent'
import { extractMechanicalRuleTextFromPlainText } from './ruleText'

export type MagicItemReferenceV038 = {
  summary: string
  fluff?: string
  range?: string
  strength?: string
  ap?: string
  rules: string[]
  bodyText: string
  sourcePath: string
  usedCollectionFallback: boolean
}

type MagicItemReferenceInputV038 = {
  name: string
  sourceName?: string
  type: 'weapon' | 'armor' | 'talisman' | 'enchanted-item' | 'arcane-item' | 'banner'
  itemPath: string
  collectionPath?: string
}

const invalidTextPatterns = [
  /^URL Copied!?$/i,
  /^Cross-Reference Links$/i,
  /^(?:Previous|Next)\b/i,
  /^Switch Index/i,
  /^Back(?: Source)?\b/i,
  /^Source\s*:/i,
  /^Last update\s*:/i,
  /^Table of Contents$/i,
  /^If the page is (?:still )?not loading properly/i,
  /^Please verify the URL in the address bar/i,
  /^If it persists, please help by using the [“"]?Bug Report/i,
  /^(?:Ravening Hordes|Forces of Fantasy|Arcane Journal|Warhammer: The Old World|Legacy Army List)\b.*(?:p\.|page)\s*\d+/i,
]

function compact(value: string) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
}

function normalizedItemName(value: string) {
  return compact(value)
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:magic weapon|magic armour|magic armor|talisman|enchanted item|arcane item|magic standard)\b/g, ' ')
    .replace(/\b\d+\s*points?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function validText(value: string) {
  const text = compact(value)
  return Boolean(text && text.length >= 5 && !invalidTextPatterns.some((pattern) => pattern.test(text)))
}

function headingMatches(value: string, wanted: string) {
  const normalized = normalizedItemName(value)
  return Boolean(normalized && wanted && (normalized === wanted || normalized.startsWith(`${wanted} `)))
}

function headingLevel(element: Element) {
  return /^H[1-6]$/.test(element.tagName) ? Number(element.tagName.slice(1)) : 7
}

function siblingSection(start: Element) {
  const rows: Element[] = []
  const level = headingLevel(start)
  let cursor = start.nextElementSibling
  while (cursor) {
    if (/^H[1-6]$/.test(cursor.tagName) && headingLevel(cursor) <= level) break
    rows.push(cursor)
    cursor = cursor.nextElementSibling
  }
  return rows
}

function sectionForItem(dom: Document, itemName: string) {
  const wanted = normalizedItemName(itemName)
  const headings = Array.from(dom.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'))
  const exactHeading = headings.find((node) => headingMatches(node.textContent || '', wanted))
  if (exactHeading) return { heading: exactHeading, rows: siblingSection(exactHeading) }

  // Some aggregate pages render item titles inside a compact block rather than
  // a semantic heading. Prefer a small title-like element and then walk the
  // surrounding siblings until the next title/table block.
  const titleNode = Array.from(dom.querySelectorAll<HTMLElement>('strong,b,p,div,span'))
    .find((node) => {
      const text = compact(node.textContent || '')
      if (!headingMatches(text, wanted) || text.length > Math.max(140, itemName.length + 80)) return false
      return !node.querySelector('table') && node.children.length <= 4
    })
  if (!titleNode) return null

  const container = titleNode.closest<HTMLElement>('article,section,li')
  if (container && compact(container.textContent || '').length < 5000) return { heading: titleNode, rows: [container] }
  return { heading: titleNode, rows: siblingSection(titleNode) }
}

function textRows(elements: Element[]) {
  const rows: string[] = []
  for (const element of elements) {
    const nodes = element.matches('p,li') ? [element] : Array.from(element.querySelectorAll('p,li'))
    for (const node of nodes) {
      const text = compact(node.textContent || '')
      if (validText(text) && !rows.some((row) => row.toLowerCase() === text.toLowerCase())) rows.push(text)
    }
  }
  return rows
}

function firstTable(elements: Element[]) {
  for (const element of elements) {
    if (element instanceof HTMLTableElement) return element
    const table = element.querySelector<HTMLTableElement>('table')
    if (table) return table
  }
  return null
}

function tableCellLabels(cell: HTMLTableCellElement | undefined) {
  if (!cell) return [] as string[]
  const anchors = Array.from(cell.querySelectorAll<HTMLElement>('a,[data-rule-path]')).map((node) => compact(node.textContent || '')).filter(Boolean)
  if (anchors.length) return [...new Set(anchors.filter((value) => !/^[-—]$/.test(value)))]
  const text = compact(cell.textContent || '')
  if (!text || /^[-—]$/.test(text)) return []
  return [...new Set(text.split(/\s*[,;|]\s*|\s{2,}/).map(compact).filter((value) => value && !/^[-—]$/.test(value)))]
}

function parseTable(table: HTMLTableElement | null) {
  if (!table) return { rules: [] as string[] }
  const rows = Array.from(table.querySelectorAll('tr'))
  const dataRow = rows.map((row) => Array.from(row.querySelectorAll<HTMLTableCellElement>('td'))).find((cells) => cells.length >= 4)
  if (!dataRow) return { rules: [] as string[] }
  return {
    range: compact(dataRow[0]?.textContent || '') || undefined,
    strength: compact(dataRow[1]?.textContent || '') || undefined,
    ap: compact(dataRow[2]?.textContent || '') || undefined,
    rules: tableCellLabels(dataRow[3]),
  }
}

function parseDocument(html: string, itemName: string, requireNamedSection = false) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,footer').forEach((node) => node.remove())
  const section = sectionForItem(dom, itemName)
  if (requireNamedSection && !section) return { rules: [] as string[], summary: '', fluff: undefined, bodyText: '' }
  const elements = section?.rows?.length ? section.rows : Array.from(dom.body.children)
  const rows = textRows(elements)
  const bodyText = rows.join(' ')
  const summary = extractMechanicalRuleTextFromPlainText(bodyText)
  const fluff = rows.find((row) => !extractMechanicalRuleTextFromPlainText(row) && row.length >= 24 && !/^Notes?:/i.test(row))
  return { ...parseTable(firstTable(elements)), summary, fluff, bodyText }
}

function scoreReference(row: ReturnType<typeof parseDocument>) {
  let score = 0
  if (row.summary) score += 8
  if (row.range) score += 2
  if (row.strength) score += 2
  if (row.ap) score += 2
  if (row.rules.length) score += 4 + row.rules.length
  if (row.bodyText && !invalidTextPatterns.some((pattern) => pattern.test(row.bodyText))) score += 1
  return score
}

function mergeReferences(primary: ReturnType<typeof parseDocument>, fallback: ReturnType<typeof parseDocument>) {
  const primaryScore = scoreReference(primary)
  const fallbackScore = scoreReference(fallback)
  const richer = fallbackScore > primaryScore ? fallback : primary
  const other = richer === primary ? fallback : primary
  return {
    range: richer.range || other.range,
    strength: richer.strength || other.strength,
    ap: richer.ap || other.ap,
    rules: [...new Set([...(richer.rules || []), ...(other.rules || [])])],
    summary: richer.summary || other.summary,
    fluff: richer.fluff || other.fluff,
    bodyText: richer.bodyText || other.bodyText,
  }
}

export async function loadMagicItemReferenceV038(input: MagicItemReferenceInputV038): Promise<MagicItemReferenceV038> {
  const directDocument = await fetchRuleDocument(input.itemPath)
  const direct = parseDocument(directDocument.html, input.sourceName || input.name)
  let resolved = direct
  let usedCollectionFallback = false

  // Old World Builder deliberately resolves canonical names to the rules index
  // and asks the rules site for its minimal representation. Some individual
  // magic-item pages omit inherited/table rules or are temporarily incomplete;
  // the corresponding collection page often still contains the full row/Notes.
  if (input.collectionPath && scoreReference(direct) < 13) {
    try {
      const collectionDocument = await fetchRuleDocument(input.collectionPath)
      const collection = parseDocument(collectionDocument.html, input.sourceName || input.name, true)
      if (scoreReference(collection) > 0) {
        resolved = mergeReferences(direct, collection)
        usedCollectionFallback = scoreReference(collection) > scoreReference(direct)
      }
    } catch {
      // The individual canonical page remains usable when a collection page is unavailable.
    }
  }

  const rules = [...new Set(resolved.rules.filter(Boolean))]
  if (input.type === 'weapon' && !rules.some((rule) => /^Magical Attacks$/i.test(rule))) rules.unshift('Magical Attacks')

  return {
    summary: resolved.summary || '',
    fluff: resolved.fluff,
    range: resolved.range,
    strength: resolved.strength,
    ap: resolved.ap,
    rules,
    bodyText: resolved.bodyText,
    sourcePath: input.itemPath,
    usedCollectionFallback,
  }
}
