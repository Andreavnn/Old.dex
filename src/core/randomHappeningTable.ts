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
    if (!roll || !value || /^D6$/i.test(roll)) return []
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
    if (cells.length < 2 || !cells[0] || /^D6$/i.test(cells[0])) continue
    const split = splitResult(cells.slice(1).join(' '))
    results.push({ roll: cells[0], ...split })
  }
  return { path, title, intro: '', results }
}

export function parseRandomHappeningTable(html: string, path: string): RandomHappeningTable {
  return parseWithDom(html, path) || parseWithRegex(html, path)
}
