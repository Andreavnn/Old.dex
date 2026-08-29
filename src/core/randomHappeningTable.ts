export type RandomHappeningResult = {
  roll: string
  title: string
  text: string
}

export type RandomHappeningTable = {
  path: string
  title: string
  intro: string
  results: RandomHappeningResult[]
}

function compact(value: string) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() }
function stripTags(value: string) { return compact(String(value || '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'")) }

function splitResult(value: string) {
  const clean = compact(value)
  const match = clean.match(/^([^:]{2,80}):\s*(.+)$/)
  return match ? { title: compact(match[1]), text: compact(match[2]) } : { title: 'Result', text: clean }
}

function isHeaderRow(roll: string, value: string) {
  const left = compact(roll)
  const right = compact(value)
  return /^(?:\d+)?D6$/i.test(left) && /^(?:result|effect|outcome)$/i.test(right)
}

function parseWithDom(html: string, path: string): RandomHappeningTable | null {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const root = doc.querySelector('main') || doc.body
  const table = root.querySelector('table')
  if (!table) return null
  const title = compact(root.querySelector('h1')?.textContent || root.querySelector('h2')?.textContent || 'Random Happening')
  const tableHeading = table.previousElementSibling
  const introRows: string[] = []
  let cursor: Element | null = tableHeading?.previousElementSibling || null
  while (cursor && introRows.length < 2) {
    if (cursor.matches('p')) introRows.unshift(compact(cursor.textContent || ''))
    cursor = cursor.previousElementSibling
  }
  const results = Array.from(table.querySelectorAll('tbody tr, tr')).flatMap((row) => {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length < 2) return []
    const roll = compact(cells[0].textContent || '')
    const value = compact(cells.slice(1).map((cell) => cell.textContent || '').join(' '))
    if (!roll || !value || isHeaderRow(roll, value) || /^D6$/i.test(roll)) return []
    const split = splitResult(value)
    return [{ roll, ...split }]
  })
  return results.length ? { path, title, intro: introRows.filter(Boolean).join(' '), results } : null
}

function parseWithRegex(html: string, path: string): RandomHappeningTable {
  const title = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || 'Random Happening')
  const tableHtml = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)?.[1] || ''
  const results: RandomHappeningResult[] = []
  for (const row of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]))
    if (cells.length < 2 || !cells[0]) continue
    const roll = cells[0]
    const value = cells.slice(1).join(' ')
    if (/^D6$/i.test(roll) || isHeaderRow(roll, value)) continue
    const split = splitResult(value)
    results.push({ roll, ...split })
  }
  return { path, title, intro: '', results }
}

export function parseRandomHappeningTable(html: string, path: string): RandomHappeningTable {
  return parseWithDom(html, path) || parseWithRegex(html, path)
}
