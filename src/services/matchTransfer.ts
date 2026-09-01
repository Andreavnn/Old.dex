import { OLDDEX_VERSION } from '../version'
import type { SavedGame } from './games'
import { loadMatchTracking } from './matchTracking'

export const MATCH_EXPORT_FORMAT = 'olddex-match'
export const MATCH_EXPORT_VERSION = 1
export const MATCH_SHARE_CODE_PREFIX = 'ODXM1:'

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function slug(value: string) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
async function compress(bytes: Uint8Array) {
  if (typeof CompressionStream === 'undefined') return { kind: 'j', bytes }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  return { kind: 'd', bytes: new Uint8Array(await new Response(stream).arrayBuffer()) }
}

export function savedMatchExportData(game: SavedGame) {
  return {
    format: MATCH_EXPORT_FORMAT,
    version: MATCH_EXPORT_VERSION,
    appVersion: OLDDEX_VERSION,
    exportedAt: new Date().toISOString(),
    game: clone(game),
    tracking: clone(loadMatchTracking(game.id)),
  }
}

export function savedMatchExportJson(game: SavedGame) {
  return JSON.stringify(savedMatchExportData(game), null, 2)
}

export function exportSavedMatch(game: SavedGame) {
  const blob = new Blob([savedMatchExportJson(game)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slug(game.name) || 'olddex-match'}.olddex-match.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function createMatchShareCode(game: SavedGame) {
  const raw = new TextEncoder().encode(JSON.stringify(savedMatchExportData(game)))
  const packed = await compress(raw)
  return `${MATCH_SHARE_CODE_PREFIX}${packed.kind}.${bytesToBase64Url(packed.bytes)}`
}
