import { RULE_REPOSITORY_ROOT, normalizeRepositoryPath, ruleIndexGroupPath } from '../data/ruleRepository'
import { nonReaderRuleSourcePaths, ruleSections } from '../data/rules'
import type { RuleDocument, RuleIndexGroup } from '../domain/ruleTypes'

const SITE_TITLE = 'Warhammer: The Old World Online Rules Index'
const BLOCKED_REPOSITORY_CHROME_PATHS = new Set(['/links', '/credit', '/sitemap'])
const QUICK_REFERENCE_HEADING_OVERRIDES = new Map<string, string>([
  ['/warhammer-battles', 'Pitched Battles'],
  ['/army-index', 'Army Rules'],
  ['/faq', 'Frequently Asked Questions'],
  ['/errata', 'Errata & Amendments'],
])
const QUICK_REFERENCE_REQUIRED_LINKS = new Map<string, string>([
  ['Frequently Asked Questions', '/faq'],
  ['Errata & Amendments', '/errata'],
])

const ARMY_SECTION_ORDER = [
  'Warhammer Armies',
  'The Lores of Magic',
  'Weapons of War',
  'Named Character Units',
  'Character Units',
  'Mount Units',
  'Infantry Units',
  'Cavalry Units',
  'Chariot Units',
  'Monster Units',
  'War Machine Units',
  'Special Rules',
]

const NON_READER_GROUP_PATH_BY_NAME = new Map(
  ruleSections
    .filter((section) => nonReaderRuleSourcePaths.has(section.sourcePath))
    .map((section) => [section.name, section.sourcePath]),
)

export function isHiddenRepositoryPath(path: string) {
  return path === '/general-principles' || path.startsWith('/general-principles/')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeHref(href: string) {
  const internal = normalizeRepositoryPath(href)
  if (internal) return { href: `${RULE_REPOSITORY_ROOT}${internal}`, internal }
  try {
    const url = new URL(href, RULE_REPOSITORY_ROOT)
    if (url.protocol === 'http:' || url.protocol === 'https:') return { href: url.href, internal: null }
  } catch {
    // ignored
  }
  return { href: '#', internal: null }
}

function safeImageSrc(src: string, sourcePath: string) {
  try {
    const url = new URL(src, `${RULE_REPOSITORY_ROOT}${sourcePath}`)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    // ignored
  }
  return null
}

function sameRepositoryPage(a: string, b: string) {
  const left = normalizeRepositoryPath(a) || a
  const right = normalizeRepositoryPath(b) || b
  return left.replace(/\/$/, '') === right.replace(/\/$/, '')
}

function isSourceChromeText(text: string) {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact === 'Back' ||
    compact === 'Return to Top' ||
    compact === 'Back to Top' ||
    compact === 'Source' ||
    /^URL\s+Copied!?$/i.test(compact) ||
    compact === 'Switch Index' ||
    (/^Switch Index/i.test(compact) && /Report Bug/i.test(compact)) ||
    compact === 'Support' ||
    compact === 'Report Bug' ||
    compact === '[Select]' ||
    compact === 'Currently displaying all results.' ||
    compact === SITE_TITLE ||
    /^\[Input:/i.test(compact) ||
    /^Back\s+Source(?::|$)/i.test(compact) ||
    /^Current Version(?::|$)/i.test(compact)
}

function isSupportPath(sourcePath: string) {
  return sourcePath === '/faq' || sourcePath.startsWith('/faq/') || sourcePath === '/errata' || sourcePath.startsWith('/errata/')
}

export function extractRepositoryVersion(value: string) {
  const match = value.match(/Current Version:\s*(?:Version\s*)?([0-9]+(?:\.[0-9]+){1,3})/i)
  return match?.[1] || undefined
}

function removeNodeAndFollowingContent(node: Element, root: HTMLElement) {
  // Remove the marker itself, then everything that follows it at each ancestor level.
  // Ancestor containers are preserved so content that appears before the marker is never discarded.
  let cursor: Node | null = node
  let removeCursor = true
  while (cursor && cursor !== root) {
    let sibling = cursor.nextSibling
    while (sibling) {
      const next = sibling.nextSibling
      sibling.parentNode?.removeChild(sibling)
      sibling = next
    }
    const parentNode: Node | null = cursor.parentNode
    if (removeCursor) {
      cursor.parentNode?.removeChild(cursor)
      removeCursor = false
    }
    cursor = parentNode
  }
}

function removeCrossReferenceBlock(clone: HTMLElement) {
  const marker = Array.from(clone.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6, p, div, span, strong'))
    .find((node) => (node.textContent?.replace(/\s+/g, ' ').trim() || '').replace(/[,:]$/, '') === 'Cross-Reference Links')
  if (marker) removeNodeAndFollowingContent(marker, clone)
}

function removeImportedSourceLines(clone: HTMLElement) {
  for (const node of Array.from(clone.querySelectorAll<HTMLElement>('p, small, span, li, div'))) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!/^(?:Source|Sources)\s*:/i.test(text)) continue
    const containsRuleStructure = Boolean(node.querySelector('h1, h2, h3, h4, h5, h6, table, ul, ol'))
    if (!containsRuleStructure && text.length <= 1200) node.remove()
  }
}

function removeRepositoryPagingLinks(clone: HTMLElement) {
  // The repository appends plain Previous/Next text links to many individual pages.
  // Old.dex supplies its own sequence navigation and breadcrumbs, so these duplicate
  // pager artifacts are removed before rendering.
  for (const anchor of Array.from(clone.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const label = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!/^(?:Previous|Next)\s*(?:-|–|—|:)/i.test(label)) continue
    const container = anchor.closest<HTMLElement>('p, li, div')
    const containerText = container?.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (container && containerText === label) container.remove()
    else anchor.remove()
  }
}

function flattenSupportHeadingLinks(clone: HTMLElement, sourcePath: string) {
  if (!isSupportPath(sourcePath)) return
  for (const anchor of Array.from(clone.querySelectorAll<HTMLAnchorElement>('h2 a, h3 a, h4 a, h5 a, h6 a'))) {
    anchor.replaceWith(document.createTextNode(anchor.textContent?.replace(/\s+/g, ' ').trim() || ''))
  }
}

function wrapSupportSectionsAsAccordions(root: HTMLElement, sourcePath: string) {
  if (sourcePath !== '/faq' && sourcePath !== '/errata') return

  const headingSelector = root.querySelector('h2') ? 'h2' : 'h3'
  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>(headingSelector))
  for (const heading of headings) {
    if (!heading.isConnected || !heading.parentElement) continue
    const parent = heading.parentElement
    const label = heading.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!label) continue

    const details = document.createElement('details')
    details.className = 'rule-support-section'
    const summary = document.createElement('summary')
    summary.className = 'rule-support-summary'
    summary.textContent = label
    const content = document.createElement('div')
    content.className = 'rule-support-content'

    parent.insertBefore(details, heading)
    details.append(summary, content)

    let cursor = heading.nextSibling
    heading.remove()
    while (cursor) {
      const next = cursor.nextSibling
      if (cursor instanceof HTMLElement && cursor.matches(headingSelector)) break
      content.appendChild(cursor)
      cursor = next
    }
  }
}

function rebuildArmyPageAsAccordions(root: HTMLElement, sourcePath: string) {
  if (!sourcePath.startsWith('/army/')) return

  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6'))
  if (!headings.length) return
  const orderedElements = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6, a[href], a[data-rule-path], table'))

  function headingLabel(heading: HTMLHeadingElement) {
    return heading.textContent?.replace(/\s+/g, ' ').trim() || ''
  }

  function headingLevel(heading: Element) {
    return /^H[2-6]$/.test(heading.tagName) ? Number.parseInt(heading.tagName.slice(1), 10) : 99
  }

  function findHeading(label: string) {
    return headings.find((heading) => headingLabel(heading).toLowerCase() === label.toLowerCase())
  }

  function nodesWithinHeading(heading: HTMLHeadingElement | undefined) {
    if (!heading) return [] as HTMLElement[]
    const startIndex = orderedElements.indexOf(heading)
    if (startIndex < 0) return [] as HTMLElement[]
    const level = headingLevel(heading)
    const nodes: HTMLElement[] = []
    for (let index = startIndex + 1; index < orderedElements.length; index += 1) {
      const element = orderedElements[index]
      if (/^H[2-6]$/.test(element.tagName) && headingLevel(element) <= level) break
      nodes.push(element)
    }
    return nodes
  }

  function linkListForHeading(heading: HTMLHeadingElement | undefined) {
    const seen = new Set<string>()
    return nodesWithinHeading(heading)
      .filter((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement)
      .filter((anchor) => !anchor.closest('h2, h3, h4, h5, h6'))
      .filter((anchor) => {
        const label = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
        const href = anchor.dataset.rulePath || anchor.dataset.appPath || anchor.getAttribute('href') || ''
        if (!label || !href || /Build Army Lists with Old World Builder/i.test(label) || /^Build Army$/i.test(label) || /View Detailed Reference Chart/i.test(label)) return false
        const key = `${label}|${href}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  function appendLinkSection(label: string, anchors: HTMLAnchorElement[], open = false) {
    if (!anchors.length) return false
    const details = document.createElement('details')
    details.className = 'rule-army-section'
    details.open = open
    const summary = document.createElement('summary')
    summary.className = 'rule-army-summary'
    summary.textContent = label
    const content = document.createElement('div')
    content.className = 'rule-army-section-content'
    const list = document.createElement('ul')
    for (const sourceAnchor of anchors) {
      const item = document.createElement('li')
      item.appendChild(sourceAnchor.cloneNode(true))
      list.appendChild(item)
    }
    content.appendChild(list)
    details.append(summary, content)
    root.appendChild(details)
    return true
  }

  const sectionLinks = new Map<string, HTMLAnchorElement[]>()

  for (const label of ARMY_SECTION_ORDER) sectionLinks.set(label, linkListForHeading(findHeading(label)))

  const knownLabels = new Set(ARMY_SECTION_ORDER)
  const extraUnitSections = headings
    .map((heading) => headingLabel(heading))
    .filter((label, index, labels) => /Units$/i.test(label) && label !== 'Units' && !knownLabels.has(label) && labels.indexOf(label) === index)
  for (const label of extraUnitSections) sectionLinks.set(label, linkListForHeading(findHeading(label)))

  const referenceHeading = findHeading('Reference Chart')
  const referenceNodes = nodesWithinHeading(referenceHeading)
  const referenceTables = referenceNodes.filter((element): element is HTMLTableElement => element instanceof HTMLTableElement)
  const hasAnySection = [...sectionLinks.values()].some((links) => links.length)
  if (!hasAnySection && !referenceTables.length) return

  root.replaceChildren()

  appendLinkSection('Warhammer Armies', sectionLinks.get('Warhammer Armies') || [], true)
  appendLinkSection('The Lores of Magic', sectionLinks.get('The Lores of Magic') || [])
  appendLinkSection('Weapons of War', sectionLinks.get('Weapons of War') || [])

  const unitOrder = [
    'Named Character Units',
    'Character Units',
    'Mount Units',
    'Infantry Units',
    'Cavalry Units',
    'Chariot Units',
    'Monster Units',
    'War Machine Units',
    ...extraUnitSections,
  ]
  const emitted = new Set<string>()
  for (const label of unitOrder) {
    if (emitted.has(label)) continue
    emitted.add(label)
    appendLinkSection(label, sectionLinks.get(label) || [])
  }

  appendLinkSection('Special Rules', sectionLinks.get('Special Rules') || [])

  if (referenceTables.length) {
    const details = document.createElement('details')
    details.className = 'rule-reference-chart-section'
    const summary = document.createElement('summary')
    summary.className = 'rule-reference-chart-summary'
    summary.textContent = 'Reference Chart'
    const content = document.createElement('div')
    content.className = 'rule-reference-chart-content'
    for (const table of referenceTables) content.appendChild(table.cloneNode(true))
    details.append(summary, content)
    root.appendChild(details)
  }
}

function cleanRuleTitle(value: string) {
  return value
    .replace(/URL\s+Copied!?/gi, '')
    .replace(/^Back\s+Source:\s*/i, '')
    .replace(new RegExp(SITE_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\s*\|\s*Warhammer:\s*The Old World.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[|—–:\-\s]+|[|—–:\-\s]+$/g, '')
    .trim() || 'Rules Reference'
}

function removeSourceChrome(clone: HTMLElement) {
  // These are controls/icons from the source website, not rules content.
  clone.querySelectorAll('svg').forEach((node) => node.remove())

  for (const anchor of Array.from(clone.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const label = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (/^(?:Back|Return to Top|Back to Top)$/i.test(label)) anchor.remove()
  }

  for (const node of Array.from(clone.querySelectorAll<HTMLElement>('p, div, span, small, aside, section'))) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || ''
    const tag = node.tagName
    const longVersionBanner = /^Current Version(?::|$)/i.test(text) && ['P', 'SPAN', 'SMALL', 'ASIDE'].includes(tag)
    const repositoryFooter = /^Switch Index/i.test(text) && /Support/i.test(text) && /Report Bug/i.test(text)
    if (longVersionBanner || repositoryFooter || (text.length <= 180 && isSourceChromeText(text))) node.remove()
  }

  // Copy controls can arrive as bare text nodes in generated index pages. Remove them without touching surrounding rule text.
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    textNodes.push(current as Text)
    current = walker.nextNode()
  }
  for (const textNode of textNodes) {
    const compact = textNode.data.replace(/\s+/g, ' ').trim()
    if (isSourceChromeText(compact)) textNode.remove()
    else if (/URL Copied!/i.test(textNode.data)) textNode.data = textNode.data.replace(/URL\s+Copied!?/gi, '').trim()
  }

  for (const anchor of Array.from(clone.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const text = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
    const target = normalizeRepositoryPath(anchor.getAttribute('href') || '')
    if (text === SITE_TITLE && target === '/') {
      const wrapper = anchor.closest('p, div, h1, h2')
      if (wrapper && (wrapper.textContent?.replace(/\s+/g, ' ').trim() || '').length <= 180) wrapper.remove()
      else anchor.remove()
    }
  }
}

function normalizeQuickReferenceHeadings(root: HTMLElement, sourcePath: string) {
  if (sourcePath !== '/') return

  for (const heading of Array.from(root.querySelectorAll<HTMLHeadingElement>('h2, h3, h4'))) {
    const currentLabel = heading.textContent?.replace(/\s+/g, ' ').trim() || ''
    let anchor = heading.querySelector<HTMLAnchorElement>('a[href], a[data-rule-path]')
    let target = heading.dataset.ruleGroupPath || anchor?.dataset.rulePath || normalizeRepositoryPath(anchor?.getAttribute('href') || '') || QUICK_REFERENCE_REQUIRED_LINKS.get(currentLabel) || null
    const override = target ? QUICK_REFERENCE_HEADING_OVERRIDES.get(target) : undefined

    if (!anchor && target && QUICK_REFERENCE_REQUIRED_LINKS.has(currentLabel)) {
      anchor = document.createElement('a')
      anchor.href = `${RULE_REPOSITORY_ROOT}${target}`
      anchor.dataset.rulePath = target
      anchor.textContent = override || currentLabel
      heading.replaceChildren(anchor)
      continue
    }

    if (anchor && override) anchor.textContent = override
    else if (!anchor && override) heading.textContent = override
  }
}

function removeContentBeforeNode(node: Element, root: HTMLElement) {
  let cursor: Node | null = node
  while (cursor && cursor !== root) {
    let sibling = cursor.previousSibling
    while (sibling) {
      const previous = sibling.previousSibling
      sibling.parentNode?.removeChild(sibling)
      sibling = previous
    }
    cursor = cursor.parentNode
  }
}

function removeSupportPagePreface(clone: HTMLElement, sourcePath: string) {
  if (sourcePath !== '/' && sourcePath !== '/faq' && sourcePath !== '/errata') return

  let firstSection: Element | null = null
  if (sourcePath === '/faq') {
    firstSection = Array.from(clone.querySelectorAll<HTMLElement>('h2, h3')).find((node) =>
      (node.textContent?.replace(/\s+/g, ' ').trim() || '') === 'General Principles',
    ) || null
  } else if (sourcePath === '/errata') {
    firstSection = Array.from(clone.querySelectorAll<HTMLElement>('h2, h3')).find((node) =>
      (node.textContent?.replace(/\s+/g, ' ').trim() || '') === 'Rulebook',
    ) || null
  } else {
    firstSection = clone.querySelector('h2') || clone.querySelector('h3, h4')
  }

  if (!firstSection) return
  removeContentBeforeNode(firstSection, clone)

  // FAQ and Errata both include a repository-only category/jump-link index before the first
  // real content heading. Strip any remnants of that index without touching the actual entries.
  if (sourcePath === '/faq' || sourcePath === '/errata') {
    let previous = firstSection.previousElementSibling
    while (previous) {
      const candidate = previous
      previous = previous.previousElementSibling
      candidate.remove()
    }
  }
}

function removeHiddenRootSections(clone: HTMLElement, sourcePath: string) {
  if (sourcePath !== '/') return
  const heading = Array.from(clone.querySelectorAll<HTMLElement>('h2')).find((node) => {
    const anchor = node.querySelector<HTMLAnchorElement>('a[href]')
    const target = anchor ? normalizeRepositoryPath(anchor.getAttribute('href') || '') : null
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || ''
    return target === '/general-principles' || text === 'General Principles'
  })
  if (!heading?.parentElement) return

  let sibling = heading.nextElementSibling
  while (sibling && sibling.tagName !== 'H2') {
    const next = sibling.nextElementSibling
    sibling.remove()
    sibling = next
  }
  heading.remove()
}

function prepareImportedImage(image: HTMLImageElement, sourcePath: string) {
  const rawSrc = image.getAttribute('src') || ''
  const alt = image.getAttribute('alt')?.trim() || ''
  const className = image.getAttribute('class') || ''
  const role = image.getAttribute('role') || ''
  const src = safeImageSrc(rawSrc, sourcePath)
  const looksDecorative = /(?:copy|clipboard|paperclip|external[-_ ]?link|permalink|anchor|logo|icon)/i.test(`${alt} ${className} ${rawSrc}`) || role === 'presentation'

  if (!src || (looksDecorative && !alt)) {
    image.remove()
    return
  }

  image.src = src
  image.loading = 'lazy'
  image.decoding = 'async'
  image.classList.add('rule-imported-image')

  const width = Number.parseInt(image.getAttribute('width') || '', 10)
  const height = Number.parseInt(image.getAttribute('height') || '', 10)
  if ((Number.isFinite(width) && width > 0 && width <= 96) || (Number.isFinite(height) && height > 0 && height <= 96) || looksDecorative) {
    image.classList.add('rule-inline-image')
  }
}

export function scrubHtml(sourceHtml: string, sourcePath: string): RuleDocument {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sourceHtml, 'text/html')
  const h1Candidates = Array.from(doc.querySelectorAll<HTMLElement>('main h1, article h1, h1'))
  const titleNode = h1Candidates.find((node) => {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || ''
    return text && text !== SITE_TITLE
  })
  const title = cleanRuleTitle(titleNode?.textContent || 'Rules Reference')
  const version = extractRepositoryVersion(sourceHtml)
  const sourceRoot = doc.querySelector('main, article') || doc.body
  const clone = sourceRoot.cloneNode(true) as HTMLElement

  clone.querySelectorAll('script, style, noscript, iframe, object, embed, form, input, select, textarea, button, nav, header, footer').forEach((node) => node.remove())
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))

  for (const element of Array.from(clone.querySelectorAll<HTMLElement>('*'))) {
    for (const attr of Array.from(element.attributes)) {
      if (/^on/i.test(attr.name) || attr.name === 'style' || attr.name === 'srcset') element.removeAttribute(attr.name)
    }
  }

  removeSourceChrome(clone)
  removeSupportPagePreface(clone, sourcePath)
  removeHiddenRootSections(clone, sourcePath)
  removeImportedSourceLines(clone)
  flattenSupportHeadingLinks(clone, sourcePath)
  removeCrossReferenceBlock(clone)
  wrapSupportSectionsAsAccordions(clone, sourcePath)
  rebuildArmyPageAsAccordions(clone, sourcePath)

  // Old.dex renders the page title itself. Any H1 remaining in the imported page is source-site/title duplication.
  clone.querySelectorAll('h1').forEach((heading) => heading.remove())

  for (const anchor of Array.from(clone.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (anchor.dataset.appPath) continue
    const rawHref = anchor.getAttribute('href') || ''
    const target = safeHref(rawHref)
    const label = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''

    if (target.internal && BLOCKED_REPOSITORY_CHROME_PATHS.has(target.internal)) {
      anchor.remove()
      continue
    }

    if (target.internal && isHiddenRepositoryPath(target.internal)) {
      anchor.replaceWith(document.createTextNode(label))
      continue
    }

    if (target.internal && nonReaderRuleSourcePaths.has(target.internal)) {
      if (sourcePath === '/') {
        const appPath = ruleIndexGroupPath('advanced', target.internal)
        const heading = anchor.closest<HTMLElement>('h2, h3, h4, h5, h6')
        if (heading) heading.dataset.ruleGroupPath = target.internal
        anchor.href = appPath
        anchor.dataset.appPath = appPath
        anchor.dataset.rulePath = target.internal
        anchor.removeAttribute('target')
        anchor.removeAttribute('rel')
      } else {
        const container = anchor.closest<HTMLElement>('li, p, h2, h3, h4, h5, h6')
        const containerText = container?.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (container && containerText === label) container.remove()
        else anchor.remove()
      }
      continue
    }

    // On Old.dex's Quick Reference (the repository table of contents), suppress the repository's own
    // Quick Reference entry so it cannot create a second, duplicate Quick Reference page.
    if (sourcePath === '/' && target.internal === '/quick-reference') {
      const heading = anchor.closest('h2, h3, h4')
      if (heading) heading.remove()
      else anchor.remove()
      continue
    }

    if (target.internal && sameRepositoryPage(target.internal, sourcePath)) {
      if (label === SITE_TITLE || label === 'Back') anchor.remove()
      else anchor.replaceWith(document.createTextNode(label))
      continue
    }

    anchor.setAttribute('href', target.href)
    if (target.internal) {
      anchor.dataset.rulePath = target.internal
      anchor.removeAttribute('target')
      anchor.removeAttribute('rel')
    } else {
      anchor.target = '_blank'
      anchor.rel = 'noreferrer'
    }
  }

  normalizeQuickReferenceHeadings(clone, sourcePath)

  for (const image of Array.from(clone.querySelectorAll<HTMLImageElement>('img[src]'))) {
    prepareImportedImage(image, sourcePath)
  }

  const meaningfulText = clone.textContent?.replace(/\s+/g, ' ').trim() || ''
  if (isSupportPath(sourcePath) && meaningfulText.length < 80) {
    throw new Error('The repository support page did not contain usable imported content.')
  }

  return {
    title,
    sourcePath,
    html: clone.innerHTML,
    fetchedAt: new Date().toISOString(),
    transport: 'proxy',
    version,
  }
}

function inlineMarkdown(value: string, sourcePath: string) {
  let text = escapeHtml(value)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
    const imageSrc = safeImageSrc(src, sourcePath)
    if (!imageSrc) return ''
    return `<img class="rule-imported-image" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`
  })
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const target = safeHref(href)
    if (target.internal && BLOCKED_REPOSITORY_CHROME_PATHS.has(target.internal)) return ''
    if (target.internal && isHiddenRepositoryPath(target.internal)) return escapeHtml(label)
    if (target.internal && nonReaderRuleSourcePaths.has(target.internal)) { if (sourcePath !== '/') return ''; const appPath = ruleIndexGroupPath('advanced', target.internal); return `<a href="${escapeHtml(appPath)}" data-app-path="${escapeHtml(appPath)}" data-rule-path="${escapeHtml(target.internal)}">${label}</a>` }
    if (sourcePath === '/' && target.internal === '/quick-reference') return escapeHtml(label)
    if (target.internal && sameRepositoryPage(target.internal, sourcePath)) return escapeHtml(label)
    const internal = target.internal ? ` data-rule-path="${escapeHtml(target.internal)}"` : ' target="_blank" rel="noreferrer"'
    return `<a href="${escapeHtml(target.href)}"${internal}>${label}</a>`
  })
  return text
}

function markdownToHtml(markdown: string, sourcePath: string) {
  const cleaned = markdown
    .replace(/^Title:\s*.*$/gm, '')
    .replace(/^URL Source:\s*.*$/gm, '')
    .replace(/^Published Time:\s*.*$/gm, '')
    .replace(/^Markdown Content:\s*/gm, '')
    .replace(/^Current Version:\s*.*$/gm, '')
    .replace(/^Back\s+Source:\s*.*$/gm, '')
    .replace(/^Back\s*$/gm, '')
    .replace(/^URL\s+Copied!?\s*$/gmi, '')
    .replace(/^Currently displaying all results\.\s*$/gmi, '')
    .replace(/^\[Input:.*\]\s*$/gmi, '')
    .replace(/^\[Select\]\s*$/gmi, '')
    .replace(/^#\s+Warhammer: The Old World Online Rules Index\s*$/gm, '')
    .replace(/^Warhammer: The Old World Online Rules Index\s*$/gm, '')
    .replace(/^.*Switch Index.*(?:Credit).*Support.*Report Bug.*$/gmi, '')
    .replace(/^Switch Index.*Report Bug\s*$/gmi, '')
    // The reader fallback normally repeats the document title as its first remaining H1.
    .replace(/^#\s+.*(?:\r?\n|$)/, '')
    .trim()

  let lines = cleaned.split(/\r?\n/)
  const crossReferenceIndex = lines.findIndex((line) => /^Cross-Reference Links\s*[,;:]?\s*$/i.test(line.trim()))
  if (crossReferenceIndex >= 0) lines = lines.slice(0, crossReferenceIndex)

  if (sourcePath === '/') {
    const hiddenStart = lines.findIndex((line) => /^##\s+(?:\[[^\]]*General Principles[^\]]*\]\([^)]+\)|General Principles)(?:\s|$)/i.test(line.trim()))
    if (hiddenStart >= 0) {
      const hiddenEndOffset = lines.slice(hiddenStart + 1).findIndex((line) => /^##\s+/.test(line.trim()))
      const hiddenEnd = hiddenEndOffset >= 0 ? hiddenStart + 1 + hiddenEndOffset : lines.length
      lines.splice(hiddenStart, hiddenEnd - hiddenStart)
    }
  }

  if (sourcePath === '/' || sourcePath === '/faq' || sourcePath === '/errata') {
    let firstSectionIndex = -1
    if (sourcePath === '/faq') {
      firstSectionIndex = lines.findIndex((line) => /^#{2,4}\s+(?:\[[^\]]*General Principles[^\]]*\]\([^)]+\)|General Principles)(?:\s|$)/i.test(line.trim()))
    } else if (sourcePath === '/errata') {
      firstSectionIndex = lines.findIndex((line) => /^#{2,4}\s+(?:\[[^\]]*Rulebook[^\]]*\]\([^)]+\)|Rulebook)(?:\s|$)/i.test(line.trim()))
    } else {
      firstSectionIndex = lines.findIndex((line) => /^#{2,4}\s+/.test(line.trim()))
    }
    if (firstSectionIndex >= 0) lines = lines.slice(firstSectionIndex)
  }

  lines = lines.filter((line) => !/^(?:Source|Sources)\s*:/i.test(line.trim()))
  const out: string[] = []
  let inList = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || isSourceChromeText(trimmed)) {
      if (inList) { out.push('</ul>'); inList = false }
      i += 1
      continue
    }

    if (sourcePath === '/' && /Quick Reference/i.test(trimmed) && /\/quick-reference/.test(trimmed)) {
      i += 1
      continue
    }

    const tableCandidate = trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])
    if (tableCandidate) {
      if (inList) { out.push('</ul>'); inList = false }
      const rows: string[][] = []
      const header = trimmed.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      i += 2
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
        i += 1
      }
      out.push('<div class="rule-table-wrap"><table><thead><tr>')
      out.push(header.map((cell) => `<th>${inlineMarkdown(cell, sourcePath)}</th>`).join(''))
      out.push('</tr></thead><tbody>')
      for (const row of rows) out.push(`<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, sourcePath)}</td>`).join('')}</tr>`)
      out.push('</tbody></table></div>')
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      if (inList) { out.push('</ul>'); inList = false }
      const level = Math.max(2, Math.min(4, heading[1].length))
      const headingText = isSupportPath(sourcePath)
        ? heading[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        : heading[2]
      out.push(`<h${level}>${inlineMarkdown(headingText, sourcePath)}</h${level}>`)
      i += 1
      continue
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/)
    if (listItem) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inlineMarkdown(listItem[1], sourcePath)}</li>`)
      i += 1
      continue
    }

    if (inList) { out.push('</ul>'); inList = false }
    out.push(`<p>${inlineMarkdown(trimmed, sourcePath)}</p>`)
    i += 1
  }

  if (inList) out.push('</ul>')
  return out.join('')
}

export function readerMarkdownDocument(markdown: string, sourcePath: string): RuleDocument {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m)
  const firstHeading = markdown.match(/^#\s+(.+)$/m)
  let html = markdownToHtml(markdown, sourcePath)
  {
    const parser = new DOMParser()
    const parsed = parser.parseFromString(`<main>${html}</main>`, 'text/html')
    const root = parsed.querySelector('main') as HTMLElement | null
    if (root) {
      removeSourceChrome(root)
      removeImportedSourceLines(root)
      removeRepositoryPagingLinks(root)
      removeCrossReferenceBlock(root)
      normalizeQuickReferenceHeadings(root, sourcePath)
      if (sourcePath === '/faq' || sourcePath === '/errata') wrapSupportSectionsAsAccordions(root, sourcePath)
      rebuildArmyPageAsAccordions(root, sourcePath)
      html = root.innerHTML
    }
  }
  const meaningfulText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (isSupportPath(sourcePath) && meaningfulText.length < 80) {
    throw new Error('The repository support page fallback did not contain usable content.')
  }
  return {
    title: cleanRuleTitle(titleMatch?.[1] || firstHeading?.[1] || 'Rules Reference'),
    sourcePath,
    html,
    fetchedAt: new Date().toISOString(),
    transport: 'reader',
    version: extractRepositoryVersion(markdown),
  }
}

function cleanIndexLabel(value: string) {
  return value
    .replace(/URL\s+Copied!?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseRuleIndexHierarchy(html: string): RuleIndexGroup[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<main>${html}</main>`, 'text/html')
  const root = doc.querySelector('main') || doc.body
  const groups: RuleIndexGroup[] = []
  const elements = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, a[data-rule-path]'))
  let current: RuleIndexGroup | null = null

  for (const element of elements) {
    if (element.tagName === 'H2' || element.tagName === 'H3') {
      const heading = element as HTMLHeadingElement
      const anchor = heading.querySelector<HTMLAnchorElement>('a[data-rule-path]')
      const name = cleanIndexLabel(heading.textContent || '')
      const sourcePath = heading.dataset.ruleGroupPath ||
        anchor?.dataset.rulePath ||
        normalizeRepositoryPath(anchor?.getAttribute('href') || '') ||
        NON_READER_GROUP_PATH_BY_NAME.get(name) ||
        ''
      if (!name || !sourcePath || sourcePath === '/') {
        current = null
        continue
      }
      current = { name, sourcePath, entries: nonReaderRuleSourcePaths.has(sourcePath) ? [] : [{ name, sourcePath }] }
      groups.push(current)
      continue
    }

    if (!current) continue
    const anchor = element as HTMLAnchorElement
    if (anchor.closest('h2, h3')) continue
    const sourcePath = anchor.dataset.rulePath || normalizeRepositoryPath(anchor.getAttribute('href') || '') || ''
    const name = cleanIndexLabel(anchor.textContent || '')
    if (!name || !sourcePath || sourcePath === '/') continue
    if (BLOCKED_REPOSITORY_CHROME_PATHS.has(sourcePath) || isHiddenRepositoryPath(sourcePath)) continue
    if (!current.entries.some((entry) => entry.sourcePath === sourcePath)) current.entries.push({ name, sourcePath })
  }

  const specialRules = groups.find((group) => group.sourcePath === '/special-rules')
  if (specialRules) {
    const whatIndex = specialRules.entries.findIndex((entry) => entry.sourcePath === '/special-rules/what-are-special-rules')
    if (whatIndex > 0) {
      const [what] = specialRules.entries.splice(whatIndex, 1)
      specialRules.entries.unshift(what)
    }
  }

  return groups
}

