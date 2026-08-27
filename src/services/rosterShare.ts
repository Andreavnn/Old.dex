import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { parseSavedArmyLists } from '../domain/schemas'
import type { SavedArmyList } from './savedLists'

export const ROSTER_SHARE_FORMAT = 'olddex-roster-share'
export const ROSTER_SHARE_VERSION = 1
export const ROSTER_SHARE_CODE_PREFIX = 'ODX1:'
const SHARE_SESSION_KEY = 'olddex.rosterShare.pending.v1'
const MAX_DECODED_BYTES = 512_000

export type SharedRosterData = {
  name: string
  army: string
  armyName: string
  composition: string
  compositionName: string
  rule: string
  points: number
  options: string[]
  description: string
  roster: BuilderRosterSelection[]
  locked?: boolean
  actualPoints?: number
  validationStatus?: 'valid' | 'invalid' | 'warning'
  enemyRoster?: boolean
}

type SharePayload = {
  format: typeof ROSTER_SHARE_FORMAT
  version: number
  appVersion: string
  roster: SharedRosterData
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function compress(bytes: Uint8Array) {
  if (typeof CompressionStream === 'undefined') return { kind: 'j', bytes }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  return { kind: 'd', bytes: new Uint8Array(await new Response(stream).arrayBuffer()) }
}
async function decompress(kind: string, bytes: Uint8Array) {
  if (kind === 'j') return bytes
  if (kind !== 'd' || typeof DecompressionStream === 'undefined') throw new Error('This shared roster uses compression that is not supported by this browser.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  const decoded = new Uint8Array(await new Response(stream).arrayBuffer())
  if (decoded.byteLength > MAX_DECODED_BYTES) throw new Error('This shared roster is too large to open safely.')
  return decoded
}

function sharedData(row: SavedArmyList): SharedRosterData {
  return clone({
    name: row.name,
    army: row.army,
    armyName: row.armyName,
    composition: row.composition,
    compositionName: row.compositionName,
    rule: row.rule,
    points: row.points,
    options: row.options || [],
    description: row.description || '',
    roster: row.roster || [],
    locked: Boolean(row.locked),
    actualPoints: row.actualPoints,
    validationStatus: row.validationStatus,
    enemyRoster: Boolean(row.enemyRoster),
  })
}

function validateSharedRoster(value: unknown): SharedRosterData {
  if (!value || typeof value !== 'object') throw new Error('The shared roster payload is invalid.')
  const row = value as Partial<SharedRosterData>
  if (!String(row.name || '').trim() || !String(row.army || '').trim() || !String(row.composition || '').trim() || !Array.isArray(row.roster)) throw new Error('The shared roster is missing required army-list data.')
  const now = new Date().toISOString()
  const parsed = parseSavedArmyLists([{
    id: 'shared-transient',
    name: String(row.name),
    army: String(row.army),
    armyName: String(row.armyName || row.army),
    composition: String(row.composition),
    compositionName: String(row.compositionName || row.composition),
    rule: String(row.rule || 'open-war'),
    points: Math.max(0, Number(row.points) || 0),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    description: String(row.description || ''),
    roster: row.roster,
    locked: Boolean(row.locked),
    actualPoints: Number.isFinite(Number(row.actualPoints)) ? Number(row.actualPoints) : undefined,
    validationStatus: ['valid','invalid','warning'].includes(String(row.validationStatus)) ? row.validationStatus : 'warning',
    enemyRoster: Boolean(row.enemyRoster),
    createdAt: now,
    updatedAt: now,
  }])[0]
  if (!parsed || !Array.isArray(parsed.roster) || parsed.roster.length !== row.roster.length) throw new Error('The shared roster failed Old.dex validation and cannot be opened.')
  return clone({
    name: parsed.name, army: parsed.army, armyName: parsed.armyName, composition: parsed.composition, compositionName: parsed.compositionName,
    rule: parsed.rule, points: parsed.points, options: parsed.options || [], description: parsed.description || '', roster: row.roster as BuilderRosterSelection[], locked: Boolean(row.locked),
    actualPoints: Number.isFinite(Number(row.actualPoints)) ? Number(row.actualPoints) : parsed.actualPoints,
    validationStatus: ['valid','invalid','warning'].includes(String(row.validationStatus)) ? row.validationStatus as SharedRosterData['validationStatus'] : parsed.validationStatus,
    enemyRoster: Boolean(row.enemyRoster),
  })
}

function legacyHashPayload(value: string) {
  const source = String(value || '').trim()
  const hashIndex = source.indexOf('#')
  const fragment = (hashIndex >= 0 ? source.slice(hashIndex + 1) : source).replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  return params.get('odx') || (fragment.startsWith('odx=') ? fragment.slice(4) : '')
}

export function rosterShareCodeFromValue(value: string) {
  const source = String(value || '').trim()
  if (!source) return ''
  const embedded = source.match(/ODX1:[dj]\.[A-Za-z0-9_-]+/)
  if (embedded) return embedded[0]
  const legacy = legacyHashPayload(source)
  if (legacy) return `${ROSTER_SHARE_CODE_PREFIX}${legacy}`
  if (source.startsWith(ROSTER_SHARE_CODE_PREFIX)) return source
  if (/^[dj]\.[A-Za-z0-9_-]+$/.test(source)) return `${ROSTER_SHARE_CODE_PREFIX}${source}`
  return source
}

export async function createRosterShareCode(row: SavedArmyList) {
  const payload: SharePayload = { format: ROSTER_SHARE_FORMAT, version: ROSTER_SHARE_VERSION, appVersion: '0.45', roster: sharedData(row) }
  const raw = new TextEncoder().encode(JSON.stringify(payload))
  const packed = await compress(raw)
  return `${ROSTER_SHARE_CODE_PREFIX}${packed.kind}.${bytesToBase64Url(packed.bytes)}`
}

export function rosterShareShortUrl(origin = window.location.origin) {
  return `${origin.replace(/\/$/, '')}/lists/shared`
}

export async function decodeRosterShareValue(value: string) {
  const code = rosterShareCodeFromValue(value)
  if (!code.startsWith(ROSTER_SHARE_CODE_PREFIX)) throw new Error('No Old.dex Share Code was found.')
  const encoded = code.slice(ROSTER_SHARE_CODE_PREFIX.length)
  const separator = encoded.indexOf('.')
  if (separator < 1) throw new Error('This Old.dex Share Code is incomplete.')
  const kind = encoded.slice(0, separator)
  const packed = base64UrlToBytes(encoded.slice(separator + 1))
  if (packed.byteLength > MAX_DECODED_BYTES) throw new Error('This shared roster is too large to open safely.')
  const bytes = await decompress(kind, packed)
  let payload: SharePayload
  try { payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload }
  catch { throw new Error('This Old.dex Share Code is damaged or incomplete.') }
  if (payload?.format !== ROSTER_SHARE_FORMAT || Number(payload.version) !== ROSTER_SHARE_VERSION) throw new Error('This roster share version is not supported by this build of Old.dex.')
  return validateSharedRoster(payload.roster)
}

// Legacy links from Alpha 0.44 remain readable, but Alpha 0.45 no longer creates
// payload-bearing URLs. Received legacy links are converted into the local staged
// Share Code flow so the address bar can immediately return to /lists/shared.
export async function decodeRosterShareHash(hash: string) {
  return decodeRosterShareValue(hash)
}

export function stageRosterShareCode(value: string) {
  const code = rosterShareCodeFromValue(value)
  if (!code.startsWith(ROSTER_SHARE_CODE_PREFIX)) throw new Error('Paste a valid Old.dex Share Code.')
  if (typeof sessionStorage === 'undefined') throw new Error('This browser cannot stage a Share Code for review.')
  sessionStorage.setItem(SHARE_SESSION_KEY, code)
  return code
}

export function pendingRosterShareCode() {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(SHARE_SESSION_KEY) || ''
}

export function clearPendingRosterShareCode() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SHARE_SESSION_KEY)
}
