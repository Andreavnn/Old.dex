import { recentDiagnostics } from './appErrors'
import { OLDDEX_BUILD_LABEL } from '../version'

export const OLDDEX_ISSUES_URL = 'https://github.com/Andreavnn/Old.dex/issues/new'

function reportEnvironment() {
  if (typeof window === 'undefined') return { path: '', userAgent: '' }
  return { path: `${window.location.pathname}${window.location.search}${window.location.hash}`, userAgent: navigator.userAgent }
}

export function buildOldDexIssueReport() {
  const environment = reportEnvironment()
  const diagnostics = recentDiagnostics().slice(0, 12)
  const rows = diagnostics.length
    ? diagnostics.map((row) => `- ${row.at} · ${row.code}: ${row.message}${Object.keys(row.context).length ? ` · ${JSON.stringify(row.context)}` : ''}`).join('\n')
    : '- No runtime diagnostics were captured in this session.'
  return [
    `Old.dex ${OLDDEX_BUILD_LABEL}`,
    `Page: ${environment.path || 'unknown'}`,
    `Browser: ${environment.userAgent || 'unknown'}`,
    '',
    'What happened:',
    '',
    '<describe the problem here>',
    '',
    'Recent Old.dex diagnostics:',
    rows,
  ].join('\n')
}

export function openOldDexIssueReport() {
  if (typeof window === 'undefined') return false
  const title = `Bug report — ${window.location.pathname || 'Old.dex'}`
  const body = buildOldDexIssueReport()
  const url = `${OLDDEX_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
