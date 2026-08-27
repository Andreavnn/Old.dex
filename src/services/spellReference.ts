import type { GameMagicChoice } from './games'
import { fetchRuleDocument } from './ruleContent'

function slug(value: string) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function compact(value: string) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() }
function key(value: string) { return compact(value).toLowerCase().replace(/\s*\(signature spell\)\s*/g, '').replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim() }

function detailValue(label: string, value: string, details: { type: string; castingValue: string; range: string }) {
  const cleanLabel = compact(label).replace(/:$/, '').toLowerCase()
  const cleanValue = compact(value)
  if (cleanLabel === 'type') details.type ||= cleanValue
  else if (cleanLabel === 'casting value') details.castingValue ||= cleanValue
  else if (cleanLabel === 'range') details.range ||= cleanValue
}

function detailsFromScope(scope: ParentNode) {
  const details = { type: '', castingValue: '', range: '', summary: '' }
  for (const row of Array.from(scope.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => compact(cell.textContent || '')).filter(Boolean)
    if (cells.length >= 2) detailValue(cells[0], cells.slice(1).join(' '), details)
  }
  for (const list of Array.from(scope.querySelectorAll('dl'))) {
    const terms = Array.from(list.children)
    for (let index = 0; index < terms.length; index++) {
      const node = terms[index]
      if (node.tagName !== 'DT') continue
      const value = terms[index + 1]?.tagName === 'DD' ? compact(terms[index + 1].textContent || '') : ''
      if (value) detailValue(node.textContent || '', value, details)
    }
  }
  const text = compact((scope as HTMLElement).textContent || '')
  details.type ||= text.match(/\bType\s*:?\s*(Magic Missile|Magical Vortex|Enchantment|Hex|Conveyance|Assailment)\b/i)?.[1] || ''
  details.castingValue ||= text.match(/\bCasting Value\s*:?\s*([0-9]+\+)/i)?.[1] || ''
  details.range ||= text.match(/\bRange\s*:?\s*([0-9]+(?:\.[0-9]+)?["”']?|Self|Combat|N\/A)/i)?.[1] || ''
  const paragraphs = Array.from(scope.querySelectorAll('p'))
    .map((node) => compact(node.textContent || ''))
    .filter((value) => value && !/^(?:URL Copied|Source:|Last update:|Type\b|Casting Value\b|Range\b)/i.test(value))
  details.summary = paragraphs.slice(-2).join(' ').slice(0, 1400)
  return details
}

function parseSpellDocument(html: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  return detailsFromScope(dom)
}

function parseSpellFromLore(html: string, spellName: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const wanted = key(spellName)
  const heading = Array.from(dom.querySelectorAll<HTMLElement>('h2,h3,h4,h5,h6')).find((node) => key(node.textContent || '') === wanted)
  if (!heading) return { type: '', castingValue: '', range: '', summary: '' }
  const holder = dom.createElement('section')
  const level = Number(heading.tagName.slice(1))
  let cursor = heading.nextElementSibling
  while (cursor) {
    if (/^H[1-6]$/.test(cursor.tagName) && Number(cursor.tagName.slice(1)) <= level) break
    holder.append(cursor.cloneNode(true))
    cursor = cursor.nextElementSibling
  }
  return detailsFromScope(holder)
}

function mergeChoice(choice: GameMagicChoice, path: string, details: ReturnType<typeof parseSpellDocument>) {
  return {
    ...choice,
    path,
    type: choice.type || details.type || undefined,
    castingValue: choice.castingValue || details.castingValue || undefined,
    range: choice.range || details.range || undefined,
    summary: choice.summary || details.summary || undefined,
  }
}

export async function enrichMagicChoice(choice: GameMagicChoice): Promise<GameMagicChoice> {
  if (choice.type && choice.castingValue && choice.summary) return { ...choice }
  const spellPath = `/spell/${slug(choice.name)}`
  try {
    const document = await fetchRuleDocument(spellPath)
    const details = parseSpellDocument(document.html)
    if (details.type || details.castingValue || details.range || details.summary) return mergeChoice(choice, spellPath, details)
  } catch { /* use lore fallback */ }

  if (choice.path && choice.path !== spellPath) {
    try {
      const document = await fetchRuleDocument(choice.path)
      const details = parseSpellFromLore(document.html, choice.name)
      if (details.type || details.castingValue || details.range || details.summary) return mergeChoice(choice, spellPath, details)
    } catch { /* retain the original choice */ }
  }
  return { ...choice }
}

export async function enrichMagicChoices(choices: GameMagicChoice[]) {
  return Promise.all(choices.map((choice) => enrichMagicChoice(choice)))
}
