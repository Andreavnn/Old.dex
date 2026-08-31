import { fetchRuleDocument } from './ruleContent'
import { extractMechanicalRuleTextFromPlainText } from './ruleText'

export type MagicItemReference = {
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

type MagicItemReferenceInput = {
  name: string
  sourceName?: string
  type: 'weapon' | 'armor' | 'talisman' | 'enchanted-item' | 'arcane-item' | 'banner'
  itemPath: string
  collectionPath?: string
  collectionName?: string
}

type ParsedReference = { rules:string[];summary:string;fluff:string|undefined;bodyText:string;range?:string;strength?:string;ap?:string }

const invalidTextPatterns = [
  /^URL Copied!?$/i, /^Cross-Reference Links$/i, /^(?:Previous|Next)\b/i, /^Switch Index/i, /^Back(?: Source)?\b/i,
  /^Source\s*:/i, /^Last update\s*:/i, /^Table of Contents$/i, /^If the page is (?:still )?not loading properly/i,
  /^Please verify the URL in the address bar/i, /^If it persists, please help by using the [“"]?Bug Report/i,
  /^(?:Ravening Hordes|Forces of Fantasy|Arcane Journal|Warhammer: The Old World|Legacy Army List)\b.*(?:p\.|page)\s*\d+/i,
]
const mechanicalPattern = /\b(?:notes?|wearer|bearer|wielder|model|unit|character|may|must|only|cannot|gains?|has|gives?|improves?|reduces?|suffers?|during|once per|single use|ward|armou?r|regeneration|characteristic|special rule|roll|test|attack|wound|hit|save|strength|toughness|leadership|initiative|movement)\b/i
const magicItemHeadingPattern = /\((?:Magic Weapon|Magic Armour|Magic Armor|Talisman|Enchanted Item|Arcane Item|Magic Standard|Magic Banner)\)\s*\d+\s*points?/i

function compact(value: string) { return String(value || '').replace(/\u00a0/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim() }

function slug(value: string) { return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function inferredCollectionPath(input: MagicItemReferenceInput) {
  if (input.collectionPath) return input.collectionPath
  const source = compact(input.collectionName || '')
  if (!source) return ''
  if (/Common Magic Items/i.test(source)) return '/magic-items/common-magic-items'
  if (/\b(?:Magic Items|Items|Runes|Gifts|Icons|Virtues|Honours|Powers|Spites|Kindreds|Names|Traits|Incantations)\b/i.test(source)) return `/magic-items/${slug(source)}`
  return ''
}

function normalizedItemName(value: string) {
  return compact(value).toLowerCase().replace(/\*/g, '').replace(/\([^)]*\)/g, ' ').replace(/\b(?:magic weapon|magic armour|magic armor|talisman|enchanted item|arcane item|magic standard|magic banner)\b/g, ' ').replace(/\b\d+\s*points?\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function validText(value: string) { const text = compact(value); return Boolean(text && text.length >= 5 && !invalidTextPatterns.some((pattern) => pattern.test(text))) }
function matchesItemTitle(value: string, wanted: string) { const normalized = normalizedItemName(value); return Boolean(normalized && wanted && normalized === wanted) }
function candidateNodes(dom: Document) { return Array.from(dom.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,table,li')) }
function itemSection(dom: Document, itemName: string, requireNamedSection = false) {
  const wanted = normalizedItemName(itemName)
  const nodes = candidateNodes(dom)
  let index = nodes.findIndex((node) => matchesItemTitle(node.textContent || '', wanted))
  if (index < 0) {
    const titles = Array.from(dom.querySelectorAll<HTMLElement>('strong,b'))
    const title = titles.find((node) => matchesItemTitle(node.textContent || '', wanted) && compact(node.textContent || '').length <= itemName.length + 80)
    if (title) {
      const parent = title.closest<HTMLElement>('p,li,h1,h2,h3,h4,h5,h6')
      index = parent ? nodes.indexOf(parent) : -1
    }
  }
  if (index < 0) return requireNamedSection ? [] : nodes
  const out: HTMLElement[] = []
  for (let cursor = index + 1; cursor < nodes.length; cursor++) {
    const node = nodes[cursor]
    const text = compact(node.textContent || '')
    if (/^H[1-2]$/.test(node.tagName) && !matchesItemTitle(text, wanted)) break
    if (magicItemHeadingPattern.test(text) && !matchesItemTitle(text, wanted)) break
    out.push(node)
  }
  return out
}
function textRows(elements: HTMLElement[]) {
  const rows: string[] = []
  for (const element of elements) {
    if (element.tagName === 'TABLE') continue
    const text = compact(element.textContent || '')
    if (!validText(text) || magicItemHeadingPattern.test(text)) continue
    if (!rows.some((row) => row.toLowerCase() === text.toLowerCase())) rows.push(text)
  }
  return rows
}
function firstTable(elements: HTMLElement[]) { return elements.find((element): element is HTMLTableElement => element instanceof HTMLTableElement) || null }
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
  return { range: compact(dataRow[0]?.textContent || '') || undefined, strength: compact(dataRow[1]?.textContent || '') || undefined, ap: compact(dataRow[2]?.textContent || '') || undefined, rules: tableCellLabels(dataRow[3]) }
}
function mechanicalSummary(rows: string[]) {
  const extracted = extractMechanicalRuleTextFromPlainText(rows.join(' '))
  if (extracted) return compact(extracted)
  const mechanical = rows.filter((row) => mechanicalPattern.test(row) && !/^Magic armou?r follows the same rules/i.test(row))
  return compact(mechanical.join(' '))
}
function parseDocument(html: string, itemName: string, requireNamedSection = false): ParsedReference {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,footer,header,aside').forEach((node) => node.remove())
  const elements = itemSection(dom, itemName, requireNamedSection)
  if (!elements.length && requireNamedSection) return { rules: [] as string[], summary: '', fluff: undefined, bodyText: '' }
  const rows = textRows(elements)
  const summary = mechanicalSummary(rows)
  const fluff = rows.find((row) => !mechanicalPattern.test(row) && row.length >= 24 && !/^Notes?:/i.test(row))
  return { ...parseTable(firstTable(elements)), summary, fluff, bodyText: compact(rows.join(' ')) }
}
function scoreReference(row: ParsedReference) { let score=0; if(row.summary)score+=8;if(row.range)score+=2;if(row.strength)score+=2;if(row.ap)score+=2;if(row.rules.length)score+=4+row.rules.length;if(row.bodyText)score+=1;return score }
function mergeReferences(primary: ParsedReference, fallback: ParsedReference) {
  const richer = scoreReference(fallback) > scoreReference(primary) ? fallback : primary
  const other = richer === primary ? fallback : primary
  return { range:richer.range||other.range,strength:richer.strength||other.strength,ap:richer.ap||other.ap,rules:[...new Set([...(richer.rules||[]),...(other.rules||[])])],summary:richer.summary||other.summary,fluff:richer.fluff||other.fluff,bodyText:richer.bodyText||other.bodyText }
}
function minimumUsefulScore(type: MagicItemReferenceInput['type']) { return type === 'weapon' ? 13 : 8 }
function emptyReference(): ParsedReference { return { rules: [], summary:'', fluff:undefined, bodyText:'' } }

export async function loadMagicItemReference(input: MagicItemReferenceInput): Promise<MagicItemReference> {
  let direct: ParsedReference = emptyReference()
  try { const document = await fetchRuleDocument(input.itemPath); direct = parseDocument(document.html, input.sourceName || input.name) }
  catch { /* Some valid items exist only on a collection page. */ }
  let resolved: ParsedReference = direct
  let usedCollectionFallback = false
  const collectionPath = inferredCollectionPath(input)
  if (collectionPath && scoreReference(direct) < minimumUsefulScore(input.type)) {
    try {
      const collectionDocument = await fetchRuleDocument(collectionPath)
      const collection = parseDocument(collectionDocument.html, input.sourceName || input.name, true)
      if (scoreReference(collection) > 0) { resolved = mergeReferences(direct, collection); usedCollectionFallback = scoreReference(collection) > scoreReference(direct) }
    } catch { /* Keep the direct entry when the collection source is unavailable. */ }
  }
  const rules = [...new Set((resolved.rules || []).filter(Boolean))]
  if (input.type === 'weapon' && !rules.some((rule) => /^Magical Attacks$/i.test(rule))) rules.unshift('Magical Attacks')
  return { summary: resolved.summary || '', fluff: resolved.fluff, range: resolved.range, strength: resolved.strength, ap: resolved.ap, rules, bodyText: resolved.bodyText || resolved.summary || '', sourcePath: input.itemPath, usedCollectionFallback }
}
