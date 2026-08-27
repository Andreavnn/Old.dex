import { parseSavedArmyLists } from '../domain/schemas'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { getSavedArmyLists, savedArmyListExportJson, type SavedArmyList } from './savedLists'
import { readStorage, removeStorage, writeJson, writeStorage } from './storage'

export interface RosterCloudConnection {
  provider: 'dropbox'
  refreshToken: string
  accountId: string
  linkedAt: string
}
export interface RosterCloudOAuth { state: string; verifier: string; redirectUri: string; startedAt: string }
export interface RosterCloudState { linkCode: string; connection: RosterCloudConnection | null; oauth: RosterCloudOAuth | null }
export interface RosterCloudConfig { configured: boolean; provider: 'dropbox'; workspaceLabel: string }
export interface RosterCloudPullResult { added: number; replaced: number; skipped: string[]; totalRemote: number }
export interface RosterCloudPushResult { created: number; updated: number; renamed: number; skipped: string[] }

const CLOUD_STORE = 'olddex.roster-cloud.v1'
const ROSTER_STORE = 'olddex.saved-lists.v2'
const DROPBOX_AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize'
const DROPBOX_TOKEN = 'https://api.dropboxapi.com/oauth2/token'
const DROPBOX_API = 'https://api.dropboxapi.com/2'
const DROPBOX_CONTENT = 'https://content.dropboxapi.com/2'
const CLOUD_SCOPES = ['files.metadata.read', 'files.content.read', 'files.content.write']
const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const MAX_REMOTE_FILES = 250
let cachedAccessToken = ''
let cachedAccessTokenExpiresAt = 0

function appKey() { return String(import.meta.env.VITE_DROPBOX_APP_KEY || '').trim() }
function configured() { return Boolean(appKey()) }
function randomString(length: number, alphabet: string) { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('') }
function randomLinkCode() { return `ODX-${randomString(24, LINK_CODE_ALPHABET)}` }
function isLinkCode(value: unknown) { return typeof value === 'string' && /^ODX-[A-Z2-9]{24}$/.test(value) }
function cleanState(value: unknown): RosterCloudState {
  const raw = value && typeof value === 'object' ? value as Partial<RosterCloudState> : {}
  const linkCode = isLinkCode(raw.linkCode) ? raw.linkCode as string : randomLinkCode()
  const candidate = raw.connection
  const connection = candidate && typeof candidate === 'object' && candidate.provider === 'dropbox' && typeof candidate.refreshToken === 'string' && candidate.refreshToken && typeof candidate.accountId === 'string' && typeof candidate.linkedAt === 'string' ? candidate as RosterCloudConnection : null
  const pending = raw.oauth
  const oauth = pending && typeof pending === 'object' && isLinkCode(pending.state) && typeof pending.verifier === 'string' && pending.verifier.length >= 43 && typeof pending.redirectUri === 'string' && typeof pending.startedAt === 'string' ? pending as RosterCloudOAuth : null
  return { linkCode, connection, oauth }
}
function saveState(state: RosterCloudState) { if (!writeStorage(CLOUD_STORE, JSON.stringify(state))) throw new Error('Old.dex could not save the local Dropbox Cloud Sync state.'); return state }
export function loadRosterCloudState(): RosterCloudState { try { return cleanState(JSON.parse(readStorage(CLOUD_STORE) || '{}')) } catch { return cleanState({}) } }
export function ensureRosterCloudState() { return saveState(loadRosterCloudState()) }
export function getRosterCloudConfig(): RosterCloudConfig { return { configured: configured(), provider: 'dropbox', workspaceLabel: 'Dropbox App Folder' } }
export function rosterCloudRedirectUri() { return `${window.location.origin}/settings` }

function base64Url(bytes: ArrayBuffer) { const view = new Uint8Array(bytes); let binary = ''; for (const byte of view) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
async function pkceChallenge(verifier: string) { return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))) }

export async function beginDropboxRosterCloudConnection(state: RosterCloudState) {
  const key = appKey()
  if (!key) throw new Error('Dropbox Cloud Sync is unavailable on this deployment.')
  if (state.connection) throw new Error('Cloud Sync is already connected. Disconnect it before linking another Dropbox account.')
  const verifier = randomString(64, VERIFIER_ALPHABET)
  const redirectUri = rosterCloudRedirectUri()
  const oauth: RosterCloudOAuth = { state: state.linkCode, verifier, redirectUri, startedAt: new Date().toISOString() }
  saveState({ ...state, oauth })
  const params = new URLSearchParams({ client_id: key, response_type: 'code', redirect_uri: redirectUri, code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256', token_access_type: 'offline', state: state.linkCode, scope: CLOUD_SCOPES.join(' ') })
  window.location.assign(`${DROPBOX_AUTHORIZE}?${params}`)
}
async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch(DROPBOX_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters) })
  let value: any = {}; try { value = await response.json() } catch {}
  if (!response.ok) throw new Error(value?.error_description || value?.error || 'Dropbox authorization failed.')
  return value
}
export async function completeDropboxRosterCloudConnection(currentUrl: string): Promise<RosterCloudState | null> {
  const state = loadRosterCloudState(); const url = new URL(currentUrl)
  const callbackState = url.searchParams.get('state') || ''; const code = url.searchParams.get('code') || ''; const oauthError = url.searchParams.get('error') || ''; const errorDescription = url.searchParams.get('error_description') || ''
  if (!state.oauth || (!callbackState && !code && !oauthError)) return null
  const clearPending = (connection: RosterCloudConnection | null = state.connection) => saveState({ ...state, connection, oauth: null })
  if (callbackState !== state.oauth.state) { clearPending(); throw new Error('Dropbox returned an unexpected Cloud Link Code. Start the Cloud Sync connection again.') }
  if (oauthError) { clearPending(); throw new Error(errorDescription || `Dropbox connection was not completed: ${oauthError}`) }
  if (!code) { clearPending(); throw new Error('Dropbox did not return an authorization code. Start the Cloud Sync connection again.') }
  const key = appKey(); if (!key) { clearPending(); throw new Error('Dropbox Cloud Sync is not configured on this Old.dex deployment.') }
  const token = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: state.oauth.redirectUri, code_verifier: state.oauth.verifier, client_id: key })
  if (typeof token.refresh_token !== 'string' || !token.refresh_token) throw new Error('Dropbox did not return the refresh token required for manual cloud updates. Disconnect Old.dex in Dropbox and connect again.')
  const connection: RosterCloudConnection = { provider: 'dropbox', refreshToken: token.refresh_token, accountId: String(token.account_id || ''), linkedAt: new Date().toISOString() }
  cachedAccessToken = String(token.access_token || ''); cachedAccessTokenExpiresAt = Date.now() + Math.max(30, Number(token.expires_in) || 0) * 1000 - 30_000
  return clearPending(connection)
}
async function accessToken(connection: RosterCloudConnection) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) return cachedAccessToken
  const key = appKey(); if (!key) throw new Error('Dropbox Cloud Sync is not configured on this Old.dex deployment.')
  const token = await tokenRequest({ refresh_token: connection.refreshToken, grant_type: 'refresh_token', client_id: key })
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Dropbox did not return an access token. Reconnect Cloud Sync.')
  cachedAccessToken = token.access_token; cachedAccessTokenExpiresAt = Date.now() + Math.max(30, Number(token.expires_in) || 0) * 1000 - 30_000
  return cachedAccessToken
}
function authHeaders(token: string, extra: Record<string, string> = {}) { return { Authorization: `Bearer ${token}`, ...extra } }
async function dropboxApi<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${DROPBOX_API}${path}`, { method: 'POST', headers: authHeaders(token, { 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
  let value: any = {}; try { value = await response.json() } catch {}
  if (!response.ok) { const summary = typeof value?.error_summary === 'string' ? value.error_summary : ''; throw new Error(summary ? `Dropbox request failed: ${summary}` : 'Dropbox request failed.') }
  return value as T
}
interface DropboxFileEntry { '.tag': 'file'; name: string; id: string; path_lower: string; path_display?: string }
interface DropboxListResult { entries: Array<DropboxFileEntry | { '.tag': string; name?: string }>; cursor: string; has_more: boolean }
async function listRosterFiles(token: string) {
  const files: DropboxFileEntry[] = []; let result = await dropboxApi<DropboxListResult>('/files/list_folder', token, { path: '', recursive: false, include_deleted: false, limit: 2000 })
  while (true) {
    for (const entry of result.entries || []) { if (entry['.tag'] !== 'file') continue; const file = entry as DropboxFileEntry; if (!/_ODX\.json$/i.test(file.name)) continue; files.push(file); if (files.length > MAX_REMOTE_FILES) throw new Error(`The Dropbox App Folder contains more than ${MAX_REMOTE_FILES} _ODX.json files. Remove or archive older files before syncing.`) }
    if (!result.has_more) break; result = await dropboxApi<DropboxListResult>('/files/list_folder/continue', token, { cursor: result.cursor })
  }
  return files
}
async function downloadJsonFile(file: DropboxFileEntry, token: string) { const response = await fetch(`${DROPBOX_CONTENT}/files/download`, { method: 'POST', headers: authHeaders(token, { 'Dropbox-API-Arg': JSON.stringify({ path: file.path_lower }) }) }); const text = await response.text(); if (!response.ok) throw new Error(`Dropbox could not read ${file.name}.`); try { return JSON.parse(text) } catch { return null } }
function validRemoteRoster(value: unknown): SavedArmyList | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  if (payload.format !== 'olddex-army-roster') return null
  const parsed = parseSavedArmyLists([{ ...payload, id: String(payload.id || ''), createdAt: String(payload.createdAt || ''), updatedAt: String(payload.updatedAt || '') }])[0] as SavedArmyList | undefined
  const rawRoster = Array.isArray(payload.roster) ? payload.roster : []
  if (!parsed || !parsed.id || !parsed.name || !parsed.army || !Array.isArray(parsed.roster) || parsed.roster.length !== rawRoster.length) return null
  return { ...parsed, roster: rawRoster as BuilderRosterSelection[] }
}
interface IndexedRemote { files: DropboxFileEntry[]; byId: Map<string, { file: DropboxFileEntry; roster: SavedArmyList }>; valid: Array<{ file: DropboxFileEntry; roster: SavedArmyList }>; skipped: string[] }
async function indexedRemoteFiles(token: string): Promise<IndexedRemote> {
  const files = await listRosterFiles(token); const byId = new Map<string, { file: DropboxFileEntry; roster: SavedArmyList }>(); const valid: Array<{ file: DropboxFileEntry; roster: SavedArmyList }> = []; const skipped: string[] = []
  for (const file of files) { const roster = validRemoteRoster(await downloadJsonFile(file, token)); if (!roster) { skipped.push(file.name); continue } if (byId.has(roster.id)) throw new Error(`Dropbox contains more than one _ODX.json file for roster ID ${roster.id}. Remove the duplicate before syncing.`); const entry = { file, roster }; byId.set(roster.id, entry); valid.push(entry) }
  return { files, byId, valid, skipped }
}
function safeStem(name: string) { return String(name || 'Roster').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '').slice(0, 82) || 'Roster' }
function filenameFor(roster: SavedArmyList, used: Set<string>, currentPath = '') { const stem = safeStem(roster.name); const current = currentPath.toLowerCase(); const available = (filename: string) => { const path = `/${filename.toLowerCase()}`; return !used.has(path) || path === current }; const preferred = `${stem}_ODX.json`; if (available(preferred)) return preferred; const suffix = roster.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'roster'; const withId = `${stem}_${suffix}_ODX.json`; if (available(withId)) return withId; for (let index = 2; index < 1000; index++) { const candidate = `${stem}_${suffix}_${index}_ODX.json`; if (available(candidate)) return candidate } throw new Error(`Could not create a unique cloud filename for ${roster.name}.`) }
async function moveFile(fromPath: string, toPath: string, token: string) { if (fromPath.toLowerCase() === toPath.toLowerCase()) return false; await dropboxApi('/files/move_v2', token, { from_path: fromPath, to_path: toPath, autorename: false, allow_ownership_transfer: false }); return true }
async function uploadFile(path: string, payload: unknown, token: string) { const response = await fetch(`${DROPBOX_CONTENT}/files/upload`, { method: 'POST', headers: authHeaders(token, { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true, strict_conflict: false }) }), body: JSON.stringify(payload, null, 2) }); if (!response.ok) { let detail = ''; try { detail = (await response.json())?.error_summary || '' } catch {}; throw new Error(detail ? `Dropbox could not upload ${path}: ${detail}` : `Dropbox could not upload ${path}.`) } }
function writeRosterStore(rows: SavedArmyList[]) { if (!writeJson(ROSTER_STORE, rows)) throw new Error('Old.dex could not save the synced roster data on this device.') }

export async function updateRostersFromCloud(connection: RosterCloudConnection): Promise<RosterCloudPullResult> {
  const token = await accessToken(connection); const remote = await indexedRemoteFiles(token); const remoteById = new Map(remote.valid.map((entry) => [entry.roster.id, entry.roster])); const local = getSavedArmyLists(); const localIds = new Set(local.map((roster) => roster.id)); let replaced = 0
  const merged = local.map((roster) => { const incoming = remoteById.get(roster.id); if (!incoming) return roster; replaced += 1; return incoming })
  let added = 0; for (const entry of remote.valid) { if (localIds.has(entry.roster.id)) continue; merged.push(entry.roster); added += 1 }
  writeRosterStore(merged); return { added, replaced, skipped: remote.skipped, totalRemote: remote.valid.length }
}
export async function uploadRostersToCloud(connection: RosterCloudConnection): Promise<RosterCloudPushResult> {
  const token = await accessToken(connection); const local = getSavedArmyLists(); if (local.length > MAX_REMOTE_FILES) throw new Error(`A single cloud upload is limited to ${MAX_REMOTE_FILES} rosters.`); const ids = local.map((roster) => roster.id); if (new Set(ids).size !== ids.length) throw new Error('Local roster data contains duplicate internal roster IDs. Resolve the duplicates before uploading to Cloud Sync.')
  const remote = await indexedRemoteFiles(token); const used = new Set(remote.files.map((file) => file.path_lower.toLowerCase())); let created = 0, updated = 0, renamed = 0
  for (const roster of local) { const existing = remote.byId.get(roster.id); const filename = filenameFor(roster, used, existing?.file.path_lower || ''); const targetPath = `/${filename}`; if (existing) { const oldPath = existing.file.path_lower; if (await moveFile(oldPath, targetPath, token)) { used.delete(oldPath.toLowerCase()); used.add(targetPath.toLowerCase()); renamed += 1 } await uploadFile(targetPath, JSON.parse(savedArmyListExportJson(roster)), token); updated += 1 } else { await uploadFile(targetPath, JSON.parse(savedArmyListExportJson(roster)), token); used.add(targetPath.toLowerCase()); created += 1 } }
  return { created, updated, renamed, skipped: remote.skipped }
}
export async function disconnectRosterCloud(state: RosterCloudState) {
  const connection = state.connection; let revoked = false
  if (connection) { try { const token = await accessToken(connection); const response = await fetch(`${DROPBOX_API}/auth/token/revoke`, { method: 'POST', headers: authHeaders(token) }); revoked = response.ok } catch {} }
  cachedAccessToken = ''; cachedAccessTokenExpiresAt = 0; if (!removeStorage(CLOUD_STORE)) throw new Error('The local Dropbox Cloud Sync state could not be removed.'); const next = cleanState({}); saveState(next); return { state: next, revoked }
}
