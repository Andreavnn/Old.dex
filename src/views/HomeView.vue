<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { deleteSavedArmyLists, duplicateSavedArmyList, exportSavedArmyList, getSavedArmyLists, importSavedArmyListJson, savedArmyListRoute, updateSavedArmyList, type SavedArmyList } from '../services/savedLists'
import { compositionOptions } from '../data/listBuilder'
import { isLegacyArmy } from '../data/armies'
import { isMagicAllowanceApproved, rosterOpenMagicAllowances } from '../services/magicAllowanceApprovals'
import { createRosterShareCode, decodeRosterShareValue, rosterShareShortUrl, stageRosterShareCode } from '../services/rosterShare'

const router = useRouter()
const savedLists = ref<SavedArmyList[]>([])
const deleteMode = ref(false)
const selectedForDelete = ref(new Set<string>())
const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const shareCodeDialogOpen = ref(false)
const receivedShareCode = ref('')
const receivedShareMessage = ref('')
const shareRoster = ref<SavedArmyList | null>(null)
const shareCode = ref('')
const shareShortUrl = ref('')
const shareMessage = ref('')
const shareBusy = ref(false)
const shareCodePreview = computed(() => {
  const code = shareCode.value
  if (!code) return ''
  return code.length <= 48 ? code : `${code.slice(0, 26)}…${code.slice(-12)}`
})

function refreshLists() { savedLists.value = getSavedArmyLists() }
onMounted(refreshLists)
const deleteCount = computed(() => selectedForDelete.value.size)
const friendlyLists = computed(() => savedLists.value.filter((list) => !list.enemyRoster))
const enemyLists = computed(() => savedLists.value.filter((list) => list.enemyRoster))
function toggleDeleteMode() { deleteMode.value = !deleteMode.value; selectedForDelete.value = new Set() }
function toggleDeleteSelection(id: string) { const next = new Set(selectedForDelete.value); next.has(id) ? next.delete(id) : next.add(id); selectedForDelete.value = next }
function deleteSelected() { if (!deleteCount.value) return; deleteSavedArmyLists([...selectedForDelete.value]); selectedForDelete.value = new Set(); deleteMode.value = false; refreshLists() }
function deleteRoster(list: SavedArmyList) {
  if (typeof window === 'undefined' || !window.confirm(`Delete ${list.name}? This roster will be removed from this device.`)) return
  deleteSavedArmyLists([list.id])
  refreshLists()
}
function copyList(id: string) { duplicateSavedArmyList(id); refreshLists() }
function toggleEnemyRoster(list: SavedArmyList) { updateSavedArmyList(list.id, { enemyRoster: !list.enemyRoster }); refreshLists() }
function toggleRosterLock(list: SavedArmyList) { updateSavedArmyList(list.id, { locked: !list.locked }); refreshLists() }
async function importListFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; importMessage.value = ''
  try { const rows = importSavedArmyListJson(await file.text()); refreshLists(); importMessage.value = `${rows.length} roster${rows.length === 1 ? '' : 's'} imported.` }
  catch (error) { importMessage.value = error instanceof Error ? error.message : 'This army-roster JSON could not be imported.' }
  finally { input.value = '' }
}
function openShareCodeImport() { receivedShareCode.value = ''; receivedShareMessage.value = ''; shareCodeDialogOpen.value = true }
function closeShareCodeImport() { shareCodeDialogOpen.value = false; receivedShareCode.value = ''; receivedShareMessage.value = '' }
async function reviewShareCode() {
  const value = receivedShareCode.value.trim()
  if (!value) { receivedShareMessage.value = 'Paste an Old.dex Share Code first.'; return }
  receivedShareMessage.value = ''
  try {
    await decodeRosterShareValue(value)
    stageRosterShareCode(value)
    closeShareCodeImport()
    await router.push({ name: 'list-shared' })
  } catch (error) { receivedShareMessage.value = error instanceof Error ? error.message : 'This Share Code could not be opened.' }
}
function optionLabel(id: string) { return compositionOptions.find((option) => option.value === id)?.label || id }
function actualPoints(list: SavedArmyList) { return list.actualPoints ?? (list.roster || []).reduce((sum, row) => sum + row.totalPoints, 0) }
function openMagicAllowancePoints(list: SavedArmyList) { return rosterOpenMagicAllowances(list.roster || []).reduce((sum, row) => sum + row.remaining, 0) }
function rosterState(list: SavedArmyList) { const actual = actualPoints(list); if (list.validationStatus === 'invalid') return 'invalid'; if (actual > list.points && !((list.options || []).includes('over-under') && actual <= list.points + 10)) return 'invalid'; if (openMagicAllowancePoints(list) > 0 && !isMagicAllowanceApproved(list.id, list.roster || [])) return 'warning'; return actual > 0 ? 'valid' : 'warning' }
function exportList(list: SavedArmyList) { exportSavedArmyList(list) }
async function openShare(list: SavedArmyList) {
  shareRoster.value = list; shareCode.value = ''; shareShortUrl.value = ''; shareMessage.value = ''; shareBusy.value = true
  try { shareCode.value = await createRosterShareCode(list); shareShortUrl.value = rosterShareShortUrl() }
  catch (error) { shareMessage.value = error instanceof Error ? error.message : 'This roster could not be prepared for sharing.' }
  finally { shareBusy.value = false }
}
function closeShare() { if (shareBusy.value) return; shareRoster.value = null; shareCode.value = ''; shareShortUrl.value = ''; shareMessage.value = '' }
async function copyShareCode() {
  if (!shareCode.value) return
  try { await navigator.clipboard.writeText(shareCode.value); shareMessage.value = 'Share Code copied.' }
  catch { shareMessage.value = 'Copy failed. Open the full Share Code below and copy it manually.' }
}
async function nativeShareRoster() {
  if (!shareRoster.value || !shareCode.value || !shareShortUrl.value || !navigator.share) return
  try { await navigator.share({ title: `${shareRoster.value.name} — Old.dex`, text: `Old.dex army roster: ${shareRoster.value.name}\nShare Code: ${shareCode.value}`, url: shareShortUrl.value }) }
  catch { /* User cancellation is not an error state. */ }
}
</script>

<template>
  <main class="page home-page">
    <AppHeader />
    <div class="page-title-block"><p class="eyebrow">ARMY ROSTERS</p><h1>Army Rosters</h1><p>Create, import and manage Old World army rosters here. Army reference browsing remains under Rules → Army Rules.</p></div>
    <section class="list-launch card-surface">
      <div class="list-launch-copy"><strong>My Rosters</strong><p>{{ savedLists.length ? `${savedLists.length} saved roster${savedLists.length === 1 ? '' : 's'}.` : 'No saved rosters yet.' }}</p><p v-if="importMessage" class="list-import-message launch-import-message" role="status">{{ importMessage }}</p></div>
      <div v-if="!deleteMode" class="list-launch-actions"><RouterLink to="/lists/create" class="primary-button">Create a roster</RouterLink><button class="secondary-button roster-transfer-icon-button" type="button" aria-label="Import roster file" title="Import Roster" @click="importInput?.click()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M12 17V9"/><path d="m8.5 12.5 3.5-3.5 3.5 3.5"/></svg></button><input ref="importInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importListFile" /><button class="secondary-button roster-transfer-icon-button" type="button" aria-label="Enter roster Share Code" title="Enter Share Code" @click="openShareCodeImport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-5 6 5 6"/><path d="m16 6 5 6-5 6"/><path d="M12 18V7"/><path d="m9 10 3-3 3 3"/></svg></button><button class="list-delete-mode-button" type="button" aria-label="Select rosters to delete" title="Delete rosters" @click="toggleDeleteMode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg></button></div>
      <div v-else class="list-delete-actions"><button class="secondary-button" type="button" @click="toggleDeleteMode">Exit</button><button class="danger-button" type="button" :disabled="!deleteCount" @click="deleteSelected">Delete {{ deleteCount || '' }} selected</button></div>
    </section>

    <section v-if="friendlyLists.length" class="roster-list-group" aria-label="Army rosters">
      <div class="roster-list-group-heading card-surface roster-list-heading-panel"><div><p class="eyebrow">ARMY ROSTERS</p><h2>Army Rosters</h2></div><span class="section-count">{{ friendlyLists.length }}</span></div>
      <div class="saved-list-stack"><article v-for="list in friendlyLists" :key="list.id" class="saved-list-card card-surface" :class="[{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }, `roster-status-${rosterState(list)}`]">
        <RouterLink v-if="!deleteMode" :to="savedArmyListRoute(list)" class="saved-list-open-area"><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div><div class="saved-list-card-meta"><strong>{{ actualPoints(list) }} / {{ list.points }} pts</strong><small>{{ rosterState(list).toUpperCase() }} · {{ list.locked ? 'Locked' : 'Open' }}</small></div></RouterLink>
        <div v-if="!deleteMode" class="saved-list-row-actions">
          <button type="button" class="saved-list-icon-action roster-export-action" aria-label="Export roster" title="Export JSON" @click="exportList(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M12 9v8"/><path d="m8.5 13.5 3.5 3.5 3.5-3.5"/></svg></button>
          <button type="button" class="saved-list-icon-action roster-lock-action" :class="{ active: list.locked }" :aria-label="list.locked ? 'Unlock roster' : 'Lock roster'" :title="list.locked ? 'Unlock roster' : 'Lock roster'" @click="toggleRosterLock(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path v-if="list.locked" d="M8 10V7a4 4 0 0 1 8 0v3"/><path v-else d="M16 10V7a4 4 0 0 0-7.7-1.5"/></svg></button>
          <button type="button" class="saved-list-icon-action enemy-roster-toggle" aria-label="Mark as enemy roster" title="Mark as Enemy Army Roster" @click="toggleEnemyRoster(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v9H3V5h3Z"/><path d="M8 6h7.2a2 2 0 0 1 1.9 1.4l1.4 4.4a2 2 0 0 1-1.9 2.6H13l.5 2.7a2 2 0 0 1-.6 1.8L12 20l-4-5.2V6Z"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Copy roster" title="Copy roster" @click="copyList(list.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Share roster code" title="Share Code" @click="openShare(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z"/></svg></button>
          <button type="button" class="saved-list-icon-action roster-delete-action" aria-label="Delete roster" title="Delete roster" @click="deleteRoster(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg></button>
        </div>
        <button v-else type="button" class="saved-list-delete-row" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)"><span class="saved-list-delete-check" aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div><strong class="saved-list-delete-points">{{ list.points }} pts</strong></button>
      </article></div>
    </section>

    <section v-if="enemyLists.length" class="roster-list-group enemy-roster-group" aria-label="Enemy army rosters">
      <div class="roster-list-group-heading card-surface roster-list-heading-panel"><div><p class="eyebrow">ENEMY ARMY ROSTERS</p><h2>Enemy Army Rosters</h2></div><span class="section-count">{{ enemyLists.length }}</span></div>
      <div class="saved-list-stack"><article v-for="list in enemyLists" :key="list.id" class="saved-list-card card-surface enemy-roster-card" :class="[{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }, `roster-status-${rosterState(list)}`]">
        <RouterLink v-if="!deleteMode" :to="{ name: 'list-view', params: { listId: list.id } }" class="saved-list-open-area"><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label enemy-roster-label">Enemy Roster</span><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div><div class="saved-list-card-meta"><strong>{{ actualPoints(list) }} / {{ list.points }} pts</strong><small>{{ rosterState(list).toUpperCase() }} · View only</small></div></RouterLink>
        <div v-if="!deleteMode" class="saved-list-row-actions enemy-roster-view-actions">
          <button type="button" class="saved-list-icon-action roster-export-action" aria-label="Export enemy roster" title="Export JSON" @click="exportList(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M12 9v8"/><path d="m8.5 13.5 3.5 3.5 3.5-3.5"/></svg></button>
          <button type="button" class="saved-list-icon-action enemy-roster-toggle active" aria-label="Move enemy roster back to friendly rosters" title="Move to Army Rosters" @click="toggleEnemyRoster(list)"><svg class="enemy-roster-return-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v9H3V5h3Z"/><path d="M8 6h7.2a2 2 0 0 1 1.9 1.4l1.4 4.4a2 2 0 0 1-1.9 2.6H13l.5 2.7a2 2 0 0 1-.6 1.8L12 20l-4-5.2V6Z"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Copy enemy roster" title="Copy roster" @click="copyList(list.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Share enemy roster code" title="Share Code" @click="openShare(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z"/></svg></button>
          <button type="button" class="saved-list-icon-action roster-delete-action" aria-label="Delete enemy roster" title="Delete roster" @click="deleteRoster(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg></button>
        </div>
        <button v-else type="button" class="saved-list-delete-row" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)"><span class="saved-list-delete-check" aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label enemy-roster-label">Enemy Roster</span><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div><strong class="saved-list-delete-points">{{ list.points }} pts</strong></button>
      </article></div>
    </section>
    <section v-if="!savedLists.length" class="empty-state card-surface compact-empty lists-empty-state"><div class="empty-icon">≡</div><h2>Your rosters will appear here</h2><p>Rosters are saved automatically on this device while you build them.</p></section>


    <div v-if="shareCodeDialogOpen" class="roster-share-backdrop" role="presentation" @click.self="closeShareCodeImport"><section class="roster-share-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="share-code-import-title"><header><div><p class="eyebrow">SHARE CODE</p><h2 id="share-code-import-title">Open Shared Roster</h2></div><button type="button" class="icon-button" aria-label="Close Share Code entry" @click="closeShareCodeImport">×</button></header><p>Paste the Old.dex Share Code you received. The roster opens on the short <strong>/lists/shared</strong> page for review before anything is saved locally.</p><textarea v-model="receivedShareCode" class="roster-share-link share-code-entry" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="ODX1:…"></textarea><p v-if="receivedShareMessage" class="list-import-message" role="status">{{ receivedShareMessage }}</p><div class="roster-share-actions"><button type="button" class="primary-button" :disabled="!receivedShareCode.trim()" @click="reviewShareCode">Review Roster</button><button type="button" class="secondary-button" @click="closeShareCodeImport">Cancel</button></div></section></div>

    <div v-if="shareRoster" class="roster-share-backdrop" role="presentation" @click.self="closeShare"><section class="roster-share-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="roster-share-title"><header><div><p class="eyebrow">SHARE ARMY ROSTER</p><h2 id="roster-share-title">{{ shareRoster.name }}</h2></div><button type="button" class="icon-button" aria-label="Close roster share" :disabled="shareBusy" @click="closeShare">×</button></header><p>Send the Share Code. The receiver opens the short Old.dex share page, pastes the code, and reviews the roster before adding it locally.</p><p v-if="shareBusy">Preparing Share Code…</p><div v-if="shareShortUrl" class="share-code-short-url"><span>Share page</span><code>{{ shareShortUrl }}</code></div><div v-if="shareCode" class="share-code-preview"><span>Share Code</span><code>{{ shareCodePreview }}</code><small>The full code is copied or sent; the URL itself stays short.</small></div><details v-if="shareCode" class="share-code-full"><summary>Show full Share Code</summary><textarea class="roster-share-link" readonly :value="shareCode" rows="5"></textarea></details><div class="roster-share-actions"><button type="button" class="primary-button" :disabled="!shareCode" @click="copyShareCode">Copy Share Code</button><button v-if="typeof navigator !== 'undefined' && 'share' in navigator" type="button" class="secondary-button" :disabled="!shareCode || !shareShortUrl" @click="nativeShareRoster">Share</button></div><p v-if="shareMessage" class="list-import-message" role="status">{{ shareMessage }}</p></section></div>
  </main>
</template>

<style scoped>
.roster-share-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.58)}.roster-share-modal{width:min(520px,100%);max-height:min(90vh,760px);overflow:auto;padding:18px;display:grid;gap:14px}.roster-share-modal>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.roster-share-modal h2{margin:0}.roster-share-modal p{margin:0}.roster-share-link{width:100%;min-height:72px;resize:vertical;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--paper-2);color:var(--ink);font:inherit;font-size:calc(9px + var(--font-offset));overflow-wrap:anywhere}.share-code-entry{min-height:118px}.roster-share-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.roster-share-modal .icon-button{font-size:24px;line-height:1}.share-code-short-url,.share-code-preview{display:grid;gap:4px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper-2)}.share-code-short-url span,.share-code-preview span{font-size:calc(8px + var(--font-offset));font-weight:850;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft)}.share-code-short-url code,.share-code-preview code{font-size:calc(10px + var(--font-offset));overflow-wrap:anywhere}.share-code-preview small{color:var(--ink-soft)}.share-code-full{border:1px solid var(--line);border-radius:10px;background:var(--paper)}.share-code-full>summary{padding:9px 11px;cursor:pointer;font-weight:800}.share-code-full .roster-share-link{border:0;border-top:1px solid var(--line);border-radius:0 0 9px 9px}
.roster-transfer-icon-button{width:44px;height:44px;min-height:44px;padding:0;flex:0 0 auto}.roster-transfer-icon-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

.saved-list-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:wrap;padding:8px 10px 10px}
.saved-list-row-actions .saved-list-icon-action{width:36px;height:36px;min-width:36px;display:inline-grid;place-items:center;padding:0;border:1px solid var(--line-dark);border-radius:10px;background:var(--paper);color:var(--ink);cursor:pointer}
.saved-list-row-actions .saved-list-icon-action:hover{border-color:var(--accent);background:var(--paper-2)}
.saved-list-row-actions .saved-list-icon-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.saved-list-row-actions .roster-export-action{background:var(--accent-dark);border-color:var(--accent-dark);color:var(--paper)}
.saved-list-row-actions .roster-export-action:hover{background:var(--accent);color:var(--paper)}
.saved-list-row-actions .roster-lock-action.active,.saved-list-row-actions .enemy-roster-toggle.active{background:var(--accent-wash);border-color:var(--accent);color:var(--ink)}
.saved-list-row-actions .roster-delete-action{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 34%,var(--line));background:color-mix(in srgb,var(--danger) 5%,var(--paper))}
.saved-list-row-actions .enemy-roster-return-icon{transform:rotate(180deg)}
@media(max-width:620px){.saved-list-row-actions{justify-content:center}}
</style>
