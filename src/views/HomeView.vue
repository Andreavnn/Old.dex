<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { deleteSavedArmyLists, duplicateSavedArmyList, exportSavedArmyList, getSavedArmyLists, importSavedArmyListJson, savedArmyListRoute, updateSavedArmyList, type SavedArmyList } from '../services/savedLists'
import { compositionOptions } from '../data/listBuilder'
import { isLegacyArmy } from '../data/armies'
import { isMagicAllowanceApproved, rosterOpenMagicAllowances } from '../services/magicAllowanceApprovals'
import { importCustomDataJson } from '../services/customData'
import { createRosterShareLink, rosterShareQrDataUrl } from '../services/rosterShare'

const savedLists = ref<SavedArmyList[]>([])
const deleteMode = ref(false)
const selectedForDelete = ref(new Set<string>())
const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const customDataInput = ref<HTMLInputElement | null>(null)
const customDataMessage = ref('')
const shareRoster = ref<SavedArmyList | null>(null)
const shareLink = ref('')
const shareQr = ref('')
const shareMessage = ref('')
const shareBusy = ref(false)

function refreshLists() { savedLists.value = getSavedArmyLists() }
onMounted(refreshLists)
const deleteCount = computed(() => selectedForDelete.value.size)
const friendlyLists = computed(() => savedLists.value.filter((list) => !list.enemyRoster))
const enemyLists = computed(() => savedLists.value.filter((list) => list.enemyRoster))
function toggleDeleteMode() { deleteMode.value = !deleteMode.value; selectedForDelete.value = new Set() }
function toggleDeleteSelection(id: string) { const next = new Set(selectedForDelete.value); next.has(id) ? next.delete(id) : next.add(id); selectedForDelete.value = next }
function deleteSelected() { if (!deleteCount.value) return; deleteSavedArmyLists([...selectedForDelete.value]); selectedForDelete.value = new Set(); deleteMode.value = false; refreshLists() }
function copyList(id: string) { duplicateSavedArmyList(id); refreshLists() }
function toggleEnemyRoster(list: SavedArmyList) { updateSavedArmyList(list.id, { enemyRoster: !list.enemyRoster }); refreshLists() }
function toggleRosterLock(list: SavedArmyList) { updateSavedArmyList(list.id, { locked: !list.locked }); refreshLists() }
async function importListFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; importMessage.value = ''
  try { const rows = importSavedArmyListJson(await file.text()); refreshLists(); importMessage.value = `${rows.length} roster${rows.length === 1 ? '' : 's'} imported.` }
  catch (error) { importMessage.value = error instanceof Error ? error.message : 'This army-roster JSON could not be imported.' }
  finally { input.value = '' }
}
async function importCustomDataFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; customDataMessage.value = ''
  try { const result = importCustomDataJson(await file.text()); customDataMessage.value = `${result.units} custom unit${result.units === 1 ? '' : 's'} imported from ${result.packs} data pack${result.packs === 1 ? '' : 's'}.` }
  catch (error) { customDataMessage.value = error instanceof Error ? error.message : 'This custom-data JSON could not be imported.' }
  finally { input.value = '' }
}
function optionLabel(id: string) { return compositionOptions.find((option) => option.value === id)?.label || id }
function actualPoints(list: SavedArmyList) { return list.actualPoints ?? (list.roster || []).reduce((sum, row) => sum + row.totalPoints, 0) }
function openMagicAllowancePoints(list: SavedArmyList) { return rosterOpenMagicAllowances(list.roster || []).reduce((sum, row) => sum + row.remaining, 0) }
function rosterState(list: SavedArmyList) { const actual = actualPoints(list); if (list.validationStatus === 'invalid') return 'invalid'; if (actual > list.points && !((list.options || []).includes('over-under') && actual <= list.points + 10)) return 'invalid'; if (openMagicAllowancePoints(list) > 0 && !isMagicAllowanceApproved(list.id, list.roster || [])) return 'warning'; return actual > 0 ? 'valid' : 'warning' }
function exportList(list: SavedArmyList) { exportSavedArmyList(list) }
async function openShare(list: SavedArmyList) {
  shareRoster.value = list; shareLink.value = ''; shareQr.value = ''; shareMessage.value = ''; shareBusy.value = true
  try { const link = await createRosterShareLink(list); shareLink.value = link; try { shareQr.value = await rosterShareQrDataUrl(link) } catch (error) { shareMessage.value = error instanceof Error ? error.message : 'QR code unavailable; use Copy Link.' } }
  catch (error) { shareMessage.value = error instanceof Error ? error.message : 'This roster could not be prepared for sharing.' }
  finally { shareBusy.value = false }
}
function closeShare() { if (shareBusy.value) return; shareRoster.value = null; shareLink.value = ''; shareQr.value = ''; shareMessage.value = '' }
async function copyShareLink() {
  if (!shareLink.value) return
  try { await navigator.clipboard.writeText(shareLink.value); shareMessage.value = 'Share link copied.' }
  catch { shareMessage.value = 'Copy failed. Select and copy the link manually.' }
}
async function nativeShareRoster() {
  if (!shareRoster.value || !shareLink.value || !navigator.share) return
  try { await navigator.share({ title: `${shareRoster.value.name} — Old.dex`, text: `Old.dex army roster: ${shareRoster.value.name}`, url: shareLink.value }) }
  catch { /* User cancellation is not an error state. */ }
}
</script>

<template>
  <main class="page home-page">
    <AppHeader />
    <div class="page-title-block"><p class="eyebrow">ARMY ROSTERS</p><h1>Army Rosters</h1><p>Create, import and manage Old World army rosters here. Army reference browsing remains under Rules → Army Rules.</p></div>
    <section class="list-launch card-surface">
      <div class="list-launch-copy"><strong>My Rosters</strong><p>{{ savedLists.length ? `${savedLists.length} saved roster${savedLists.length === 1 ? '' : 's'}.` : 'No saved rosters yet.' }}</p><p v-if="importMessage" class="list-import-message launch-import-message" role="status">{{ importMessage }}</p><p v-if="customDataMessage" class="list-import-message launch-import-message" role="status">{{ customDataMessage }}</p></div>
      <div v-if="!deleteMode" class="list-launch-actions"><RouterLink to="/lists/create" class="primary-button">Create a roster</RouterLink><button class="secondary-button" type="button" @click="importInput?.click()">Import roster</button><input ref="importInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importListFile" /><button class="secondary-button" type="button" @click="customDataInput?.click()">Import custom data</button><input ref="customDataInput" class="file-import-input" type="file" accept=".json,.olddex-custom.json,application/json" @change="importCustomDataFile" /><button class="list-delete-mode-button" type="button" aria-label="Select rosters to delete" title="Delete rosters" @click="toggleDeleteMode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg></button></div>
      <div v-else class="list-delete-actions"><button class="secondary-button" type="button" @click="toggleDeleteMode">Exit</button><button class="danger-button" type="button" :disabled="!deleteCount" @click="deleteSelected">Delete {{ deleteCount || '' }} selected</button></div>
    </section>

    <section v-if="friendlyLists.length" class="roster-list-group" aria-label="Army rosters">
      <div class="roster-list-group-heading card-surface roster-list-heading-panel"><div><p class="eyebrow">ARMY ROSTERS</p><h2>Army Rosters</h2></div><span class="section-count">{{ friendlyLists.length }}</span></div>
      <div class="saved-list-stack"><article v-for="list in friendlyLists" :key="list.id" class="saved-list-card card-surface" :class="[{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }, `roster-status-${rosterState(list)}`]">
        <RouterLink v-if="!deleteMode" :to="savedArmyListRoute(list)" class="saved-list-open-area"><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div><div class="saved-list-card-meta"><strong>{{ actualPoints(list) }} / {{ list.points }} pts</strong><small>{{ rosterState(list).toUpperCase() }} · {{ list.locked ? 'Locked' : 'Open' }}</small></div></RouterLink>
        <div v-if="!deleteMode" class="saved-list-row-actions">
          <RouterLink class="saved-list-icon-action" :to="{ name: 'list-view', params: { listId: list.id } }" aria-label="View roster" title="View roster"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z"/><circle cx="12" cy="12" r="2.5"/></svg></RouterLink>
          <button type="button" class="saved-list-icon-action roster-lock-action" :class="{ active: list.locked }" :aria-label="list.locked ? 'Unlock roster' : 'Lock roster'" :title="list.locked ? 'Unlock roster' : 'Lock roster'" @click="toggleRosterLock(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path v-if="list.locked" d="M8 10V7a4 4 0 0 1 8 0v3"/><path v-else d="M16 10V7a4 4 0 0 0-7.7-1.5"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Export roster" title="Export JSON" @click="exportList(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg></button>
          <button type="button" class="saved-list-icon-action" aria-label="Share roster" title="Share roster by QR code or link" @click="openShare(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2"/><circle cx="17.5" cy="6" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/><path d="m8 11 7.4-4M8 13l7.4 4"/></svg></button>
          <button type="button" class="saved-list-icon-action enemy-roster-toggle" aria-label="Mark as enemy roster" title="Mark as Enemy Army Roster" @click="toggleEnemyRoster(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M6 5h11l-2.5 3L17 11H6"/></svg></button>
          <button type="button" class="saved-list-copy-button" aria-label="Copy roster" title="Copy roster" @click="copyList(list.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
        </div>
        <button v-else type="button" class="saved-list-delete-row" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)"><span class="saved-list-delete-check" aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div><strong class="saved-list-delete-points">{{ list.points }} pts</strong></button>
      </article></div>
    </section>

    <section v-if="enemyLists.length" class="roster-list-group enemy-roster-group" aria-label="Enemy army rosters">
      <div class="roster-list-group-heading card-surface roster-list-heading-panel"><div><p class="eyebrow">ENEMY ARMY ROSTERS</p><h2>Enemy Army Rosters</h2></div><span class="section-count">{{ enemyLists.length }}</span></div>
      <div class="saved-list-stack"><article v-for="list in enemyLists" :key="list.id" class="saved-list-card card-surface enemy-roster-card" :class="[{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }, `roster-status-${rosterState(list)}`]">
        <RouterLink v-if="!deleteMode" :to="{ name: 'list-view', params: { listId: list.id } }" class="saved-list-open-area"><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label enemy-roster-label">Enemy Roster</span><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div><div class="saved-list-card-meta"><strong>{{ actualPoints(list) }} / {{ list.points }} pts</strong><small>{{ rosterState(list).toUpperCase() }} · View only</small></div></RouterLink>
        <div v-if="!deleteMode" class="saved-list-row-actions enemy-roster-view-actions"><RouterLink class="saved-list-icon-action" :to="{ name: 'list-view', params: { listId: list.id } }" aria-label="View enemy roster" title="View enemy roster"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z"/><circle cx="12" cy="12" r="2.5"/></svg></RouterLink><button type="button" class="saved-list-icon-action" aria-label="Share enemy roster" title="Share roster by QR code or link" @click="openShare(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2"/><circle cx="17.5" cy="6" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/><path d="m8 11 7.4-4M8 13l7.4 4"/></svg></button><button type="button" class="saved-list-icon-action enemy-roster-toggle active" aria-label="Move enemy roster back to friendly rosters" title="Move to Army Rosters" @click="toggleEnemyRoster(list)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M6 5h11l-2.5 3L17 11H6"/></svg></button></div>
        <button v-else type="button" class="saved-list-delete-row" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)"><span class="saved-list-delete-check" aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span><div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label enemy-roster-label">Enemy Roster</span><span v-if="isLegacyArmy(list.army)" class="app-option-label legacy-roster-label">LEGACY</span><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div><strong class="saved-list-delete-points">{{ list.points }} pts</strong></button>
      </article></div>
    </section>
    <section v-if="!savedLists.length" class="empty-state card-surface compact-empty lists-empty-state"><div class="empty-icon">≡</div><h2>Your rosters will appear here</h2><p>Rosters are saved automatically on this device while you build them.</p></section>

    <div v-if="shareRoster" class="roster-share-backdrop" role="presentation" @click.self="closeShare"><section class="roster-share-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="roster-share-title"><header><div><p class="eyebrow">SHARE ARMY ROSTER</p><h2 id="roster-share-title">{{ shareRoster.name }}</h2></div><button type="button" class="icon-button" aria-label="Close roster share" :disabled="shareBusy" @click="closeShare">×</button></header><p>Scan the QR code or copy the link. The receiving player can review the roster before choosing Add to My Rosters.</p><p v-if="shareBusy">Preparing share link…</p><img v-if="shareQr" class="roster-share-qr" :src="shareQr" alt="QR code for the shared Old.dex army roster" /><textarea v-if="shareLink" class="roster-share-link" readonly :value="shareLink" rows="3"></textarea><div class="roster-share-actions"><button type="button" class="primary-button" :disabled="!shareLink" @click="copyShareLink">Copy Link</button><button v-if="typeof navigator !== 'undefined' && 'share' in navigator" type="button" class="secondary-button" :disabled="!shareLink" @click="nativeShareRoster">Share</button></div><p v-if="shareMessage" class="list-import-message" role="status">{{ shareMessage }}</p></section></div>
  </main>
</template>

<style scoped>
.roster-share-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.58)}.roster-share-modal{width:min(520px,100%);max-height:min(90vh,760px);overflow:auto;padding:18px;display:grid;gap:14px}.roster-share-modal>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.roster-share-modal h2{margin:0}.roster-share-modal p{margin:0}.roster-share-qr{width:min(320px,82vw);aspect-ratio:1;justify-self:center;background:#fff;padding:8px;border-radius:12px}.roster-share-link{width:100%;min-height:72px;resize:none;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--paper-2);color:var(--ink);font:inherit;font-size:calc(9px + var(--font-offset));overflow-wrap:anywhere}.roster-share-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.roster-share-modal .icon-button{font-size:24px;line-height:1}
</style>
