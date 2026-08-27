<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useSettings, type BackgroundChoice, type FontSize, type VisualTheme } from '../settings'
import { forceRefreshBuilderData } from '../services/armyData'
import { forceRefreshRulePages } from '../services/ruleContent'
import { armies } from '../data/armies'
import { battleScenarioEntries, nonReaderRuleSourcePaths, ruleSections, supportPages } from '../data/rules'
import { armySourcePath } from '../data/ruleRepository'
import { removeStorage, storageKeys, writeStorage } from '../services/storage'
import { reportAppError } from '../services/appErrors'
import { clearSavedGamesByStatus } from '../services/games'
import { clearSavedArmyListsByType } from '../services/savedLists'
import { useInstallApp } from '../services/installApp'
import { importCustomDataJson } from '../services/customData'
import { beginDropboxRosterCloudConnection, completeDropboxRosterCloudConnection, disconnectRosterCloud, ensureRosterCloudState, getRosterCloudConfig, updateRostersFromCloud, uploadRostersToCloud } from '../services/rosterCloud'
import { OLDDEX_DISCORD_URL, shareOldDex } from '../services/siteShare'

const { darkMode, compactRows, fontSize, boldText, visualTheme, backgroundImage, bootAudioEnabled, reset } = useSettings()
const updateState = ref<'idle' | 'running' | 'success' | 'error'>('idle')
const updateMessage = ref('')
const dataResetState = ref<'idle' | 'running'>('idle')
const customDataInput = ref<HTMLInputElement | null>(null)
const customDataMessage = ref('')
const rosterCloudState = ref(ensureRosterCloudState())
const rosterCloudConfig = getRosterCloudConfig()
const rosterCloudMessage = ref('')
const rosterCloudBusy = ref(false)
const rosterCloudConnection = computed(() => rosterCloudState.value.connection)
const rosterCloudConnected = computed(() => Boolean(rosterCloudConnection.value))

const { installPrompt, installedApp, requestInstall: requestOldDexInstall } = useInstallApp()
async function installOldDex() {
  const result = await requestOldDexInstall()
  if (result.outcome === 'unavailable' && typeof window !== 'undefined') window.alert('Use your browser menu and choose “Install app” or “Add to Home Screen” to install Old.dex on this device.')
}
function openDiscord() { if (typeof window !== 'undefined') window.open(OLDDEX_DISCORD_URL, '_blank', 'noopener,noreferrer') }
async function shareSite() {
  const result = await shareOldDex()
  if (!result.ok && result.message !== 'Share cancelled.' && typeof window !== 'undefined') window.alert(result.message)
}

const themeOptions: Array<{ value: Exclude<VisualTheme, 'default'>; label: string; note: string }> = [
  { value: 'forces-of-fantasy', label: 'Forces of Fantasy', note: 'Cool blue and heraldic parchment accents.' },
  { value: 'powers-of-chaos', label: 'Powers of Chaos', note: 'Crimson, brass and dark iron accents.' },
  { value: 'legions-of-undead', label: 'Legions of Undead', note: 'Cold bone, grave-green and ancient metal accents.' },
  { value: 'ravening-hordes', label: 'Ravening Hordes', note: 'Muted green, ochre and field-parchment accents.' },
]
const currentThemeLabel = computed(() => themeOptions.find((option) => option.value === visualTheme.value)?.label || 'Default')
const backgroundOptions: Array<{ value: Exclude<BackgroundChoice, 'none'>; label: string }> = [
  { value: 'background-1', label: 'Background 1' }, { value: 'background-2', label: 'Background 2' }, { value: 'background-3', label: 'Background 3' }, { value: 'background-4', label: 'Background 4' },
]
const currentBackgroundLabel = computed(() => backgroundOptions.find((option) => option.value === backgroundImage.value)?.label || 'Off')
function toggleBackground(value: Exclude<BackgroundChoice, 'none'>, event: Event) { const checked = Boolean((event.target as HTMLInputElement | null)?.checked); backgroundImage.value = checked ? value : (backgroundImage.value === value ? 'none' : backgroundImage.value) }
function toggleVisualTheme(value: Exclude<VisualTheme, 'default'>, event: Event) { const checked = Boolean((event.target as HTMLInputElement | null)?.checked); visualTheme.value = checked ? value : (visualTheme.value === value ? 'default' : visualTheme.value) }

function resetLocalData() {
  if (typeof window === 'undefined' || dataResetState.value === 'running') return
  if (!window.confirm('Reset Old.dex local data? This removes saved army lists, favorites, cached rule/army content, and other locally added app data. Display settings and themes are preserved.')) return
  dataResetState.value = 'running'
  storageKeys().filter((key) => key.startsWith('olddex.') && !key.startsWith('olddex.settings.')).forEach((key) => removeStorage(key))
  window.setTimeout(() => window.location.reload(), 120)
}
function clearLocalCategory(kind: 'open-games' | 'history' | 'friendly-rosters' | 'enemy-rosters') {
  if (typeof window === 'undefined') return
  const labels = { 'open-games': 'all ongoing matches', history: 'all completed match history', 'friendly-rosters': 'all friendly army rosters', 'enemy-rosters': 'all enemy army rosters' } as const
  if (!window.confirm(`Clear ${labels[kind]} from this device? This cannot be undone.`)) return
  if (kind === 'open-games') clearSavedGamesByStatus('open'); else if (kind === 'history') clearSavedGamesByStatus('complete'); else if (kind === 'friendly-rosters') clearSavedArmyListsByType(false); else clearSavedArmyListsByType(true)
}
const fontOptions: Array<{ value: FontSize; label: string }> = [
  { value: 'smallest', label: 'Smallest' }, { value: 'small', label: 'Smaller' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Larger' }, { value: 'largest', label: 'Largest' },
]
const configuredRulePages = [
  ...ruleSections.filter((rule) => !nonReaderRuleSourcePaths.has(rule.sourcePath)).map((rule) => rule.sourcePath), ...supportPages.map((page) => page.sourcePath), ...battleScenarioEntries.map((scenario) => scenario.sourcePath), ...armies.map((army) => armySourcePath(army.slug)),
]
async function importCustomDataFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; customDataMessage.value = ''
  try { const result = importCustomDataJson(await file.text()); customDataMessage.value = `${result.units} custom unit${result.units === 1 ? '' : 's'} imported from ${result.packs} data pack${result.packs === 1 ? '' : 's'}.` }
  catch (error) { customDataMessage.value = error instanceof Error ? error.message : 'This custom-data JSON could not be imported.' }
  finally { input.value = '' }
}
async function updateBuilderRules() {
  if (updateState.value === 'running') return; updateState.value = 'running'; updateMessage.value = 'Refreshing Builder data…'
  try {
    const builder = await forceRefreshBuilderData((completed, total) => { updateMessage.value = `Refreshing Builder data… ${completed}/${total}` })
    const rules = await forceRefreshRulePages(configuredRulePages, (completed, total) => { updateMessage.value = `Refreshing rule repository… ${completed}/${total}` })
    const when = new Date(); writeStorage('olddex.lastRemoteUpdate', when.toISOString())
    if (rules.failed) { updateState.value = 'error'; updateMessage.value = `Builder data refreshed. ${rules.refreshed}/${rules.total} rule pages refreshed; ${rules.failed} could not be loaded.`; return }
    updateState.value = 'success'; updateMessage.value = `Updated ${builder.refreshed} Builder data sources and ${rules.refreshed} rule pages at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  } catch (error) { reportAppError(error, 'SETTINGS_REMOTE_REFRESH'); updateState.value = 'error'; updateMessage.value = error instanceof Error ? error.message : 'Remote update failed.' }
}
async function connectRosterCloud() {
  if (rosterCloudBusy.value || rosterCloudConnected.value) return
  rosterCloudBusy.value = true; rosterCloudMessage.value = 'Opening Dropbox…'
  try { await beginDropboxRosterCloudConnection(rosterCloudState.value) }
  catch (error) { rosterCloudBusy.value = false; rosterCloudMessage.value = error instanceof Error ? error.message : 'Dropbox could not start the Cloud Sync connection.' }
}
async function updateRosterCloud() {
  const connection = rosterCloudConnection.value; if (!connection || rosterCloudBusy.value) return
  rosterCloudBusy.value = true; rosterCloudMessage.value = ''
  try { const result = await updateRostersFromCloud(connection); const skipped = result.skipped.length ? ` ${result.skipped.length} invalid _ODX.json ${result.skipped.length === 1 ? 'file was' : 'files were'} skipped.` : ''; rosterCloudMessage.value = `Cloud update complete: ${result.replaced} replaced, ${result.added} added.${skipped}` }
  catch (error) { rosterCloudMessage.value = error instanceof Error ? error.message : 'Cloud update failed.' }
  finally { rosterCloudBusy.value = false }
}
async function uploadRosterCloud() {
  const connection = rosterCloudConnection.value; if (!connection || rosterCloudBusy.value) return
  if (!window.confirm('Upload all local army rosters to the Old.dex Dropbox App Folder? Existing cloud files with the same internal roster ID will be replaced.')) return
  rosterCloudBusy.value = true; rosterCloudMessage.value = ''
  try { const result = await uploadRostersToCloud(connection); const skipped = result.skipped.length ? ` ${result.skipped.length} invalid existing _ODX.json ${result.skipped.length === 1 ? 'file was' : 'files were'} ignored.` : ''; rosterCloudMessage.value = `Cloud upload complete: ${result.updated} updated, ${result.created} created${result.renamed ? `, ${result.renamed} renamed` : ''}.${skipped}` }
  catch (error) { rosterCloudMessage.value = error instanceof Error ? error.message : 'Cloud upload failed.' }
  finally { rosterCloudBusy.value = false }
}
async function disconnectCloud() {
  if (!rosterCloudConnection.value || rosterCloudBusy.value) return
  if (!window.confirm('Disconnect Dropbox Cloud Sync from this device? Cloud files will not be deleted.')) return
  rosterCloudBusy.value = true; rosterCloudMessage.value = ''
  try { const result = await disconnectRosterCloud(rosterCloudState.value); rosterCloudState.value = result.state; rosterCloudMessage.value = result.revoked ? 'Dropbox Cloud Sync was disconnected and its authorization was revoked.' : 'Dropbox Cloud Sync was disconnected from this device. If Dropbox authorization was already unavailable, remove Old.dex from Dropbox Connected Apps if you also want to revoke it there.' }
  catch (error) { rosterCloudMessage.value = error instanceof Error ? error.message : 'The cloud connection could not be removed from local storage.' }
  finally { rosterCloudBusy.value = false }
}
onMounted(async () => {
  const url = new URL(window.location.href)
  const hasDropboxReturn = Boolean(rosterCloudState.value.oauth && (url.searchParams.get('code') || url.searchParams.get('state') || url.searchParams.get('error')))
  if (!hasDropboxReturn) return
  rosterCloudBusy.value = true
  try { const next = await completeDropboxRosterCloudConnection(window.location.href); if (next) { rosterCloudState.value = next; rosterCloudMessage.value = 'Dropbox Cloud Sync connected. Rosters remain stored locally and Dropbox is contacted only when you choose Update from Cloud or Upload Local.' } }
  catch (error) { rosterCloudMessage.value = error instanceof Error ? error.message : 'Dropbox Cloud Sync could not complete the connection.' }
  finally { rosterCloudBusy.value = false; window.history.replaceState({}, document.title, window.location.pathname) }
})
</script>

<template>
  <main class="page settings-page">
    <AppHeader />
    <div class="page-title-block"><p class="eyebrow">SETTINGS</p><h1>Settings</h1><p>Display preferences are stored on this device. Remote Builder data and rule content can also be manually refreshed without waiting for normal cache expiry.</p></div>

    <section class="settings-group" aria-label="Access and community"><div class="settings-group-heading"><p class="eyebrow settings-group-title">ACCESS &amp; COMMUNITY</p></div><section class="settings-card">
      <div class="setting-row install-setting-row"><span><strong>Install Old.dex</strong><small>{{ installedApp ? 'Old.dex is running as an installed app on this device.' : installPrompt ? 'Install Old.dex as an app on this phone, tablet, or computer.' : 'Old.dex is installable. If the direct prompt is unavailable, use your browser menu and choose Install app or Add to Home Screen.' }}</small></span><button class="secondary-button settings-compact-action" type="button" :disabled="installedApp" @click="installOldDex">{{ installedApp ? 'Installed' : 'Install' }}</button></div>
      <div class="setting-row"><span><strong>Join Discord</strong><small>Join the Old.dex community Discord for discussion, feedback, and development updates.</small></span><button class="secondary-button settings-compact-action" type="button" @click="openDiscord">Join</button></div>
      <div class="setting-row"><span><strong>Share Old.dex</strong><small>Share Old.dex using your device share sheet or copy the site link.</small></span><button class="secondary-button settings-compact-action" type="button" @click="shareSite">Share</button></div>
    </section></section>

    <section class="settings-group" aria-label="Report bugs and issues"><div class="settings-group-heading"><p class="eyebrow settings-group-title">REPORT BUGS &amp; ISSUES</p></div><section class="settings-card"><div class="setting-row static-row support-placeholder-row"><span><strong>Bug &amp; issue reporting</strong><small>A direct Old.dex issue-reporting workflow will be added here in a later build.</small></span><span class="value-chip">COMING SOON</span></div></section></section>

    <section class="settings-group" aria-label="Display settings"><div class="settings-group-heading"><p class="eyebrow settings-group-title">DISPLAY</p></div><section class="settings-card">
      <label class="setting-row"><span><strong>Dark mode</strong><small>The same theme setting controlled by the light/dark button in the top-right header.</small></span><input v-model="darkMode" type="checkbox" /></label>
      <label class="setting-row"><span><strong>Compact rows</strong><small>Reduce list and reference row height throughout Old.dex.</small></span><input v-model="compactRows" type="checkbox" /></label>
      <div class="setting-row"><span><strong>Text size</strong><small>Choose from two steps below or above the normal interface text size. Normal uses the original site-wide interface scale; the enlarged Old.dex header is independent of this setting.</small></span><div class="font-size-control" role="group" aria-label="Text size"><button v-for="option in fontOptions" :key="option.value" type="button" :class="{ active: fontSize === option.value }" @click="fontSize = option.value">{{ option.label }}</button></div></div>
      <label class="setting-row"><span><strong>Bold text</strong><small>Increase the weight of normal interface and reference text.</small></span><input v-model="boldText" type="checkbox" /></label>
      <label class="setting-row"><span><strong>Launch Audio</strong><small>Play the Olddex 'Murderin' when the installed app opens.</small></span><input v-model="bootAudioEnabled" type="checkbox" /></label>
      <details class="theme-settings-panel"><summary><span><strong>Themes</strong><small>Faction themes change the Old.dex palette while preserving the selected light or dark mode.</small></span><span class="value-chip">{{ currentThemeLabel }}</span></summary><div class="theme-option-list"><label v-for="theme in themeOptions" :key="theme.value" class="theme-option-row setting-row"><span><strong>{{ theme.label }}</strong><small>{{ theme.note }}</small></span><input :checked="visualTheme === theme.value" type="checkbox" @change="toggleVisualTheme(theme.value, $event)" /></label></div></details>
      <details class="background-settings-panel"><summary><span><strong>Backgrounds</strong><small>Use one fixed background image behind Old.dex. The image stays centered as you move through the application.</small></span><span class="value-chip">{{ currentBackgroundLabel }}</span></summary><div class="background-option-list"><label v-for="background in backgroundOptions" :key="background.value" class="background-option-row setting-row"><span class="background-option-copy"><span class="background-preview" :class="background.value" aria-hidden="true"></span><strong>{{ background.label }}</strong></span><input :checked="backgroundImage === background.value" type="checkbox" @change="toggleBackground(background.value, $event)" /></label></div></details>
      <div class="setting-row reset-setting-row"><span><strong>Reset local settings</strong><small>Restore the display preferences on this device to their defaults.</small></span><button class="secondary-button settings-compact-action" type="button" @click="reset">Reset</button></div>
    </section></section>

    <section class="settings-group compact-donation-group" aria-label="Donation"><div class="settings-group-heading"><p class="eyebrow settings-group-title">DONATION</p></div><section class="settings-card support-settings-card"><div class="setting-row donation-setting-row"><span><strong>Support Old.dex</strong><small>Support development with a one-time donation or recurring contribution.</small></span><div class="support-button-row compact-support-buttons"><a class="secondary-button support-action-button" href="https://buy.stripe.com/7sY9ATaA64LEf2Adzz3Nm02" target="_blank" rel="noopener noreferrer">Donation</a><a class="secondary-button support-action-button" href="https://buy.stripe.com/4gM5kDbEa6TM9Ig7bb3Nm03" target="_blank" rel="noopener noreferrer">Recurring Support</a></div></div></section></section>

    <section class="settings-group" aria-label="Data and content settings"><div class="settings-group-heading"><p class="eyebrow settings-group-title">DATA &amp; CONTENT</p></div><section class="settings-card">
      <details class="custom-data-panel roster-data-panel"><summary><span><strong>Roster Data</strong><small>Army rosters are stored locally. Optionally link Dropbox for cloud base storage.</small></span><span class="roster-data-status-pills"><span class="value-chip">LOCAL</span><span class="value-chip">{{ rosterCloudConnected ? 'CONNECTED' : 'DISCONNECTED' }}</span></span></summary><div class="custom-data-actions custom-data-stack"><div class="setting-row"><span><strong>Local Roster Storage</strong><small>Friendly and enemy army rosters continue to use this device as their active storage. Cloud Sync never replaces local storage as the live roster database.</small></span><span class="value-chip">LOCAL</span></div></div></details>
      <details class="custom-data-panel cloud-sync-panel"><summary><span><strong>Cloud Sync</strong><small>Optionally connect Dropbox App Folder storage for explicit roster updates and uploads.</small></span><span class="value-chip">DROPBOX</span></summary><div class="custom-data-actions custom-data-stack">
        <div class="setting-row roster-cloud-detail"><span><strong>Dropbox App Folder</strong><small>Old.dex uses Dropbox App Folder access, so it can read and write only the folder Dropbox assigns to this app. Nothing is polled in the background. Only files ending in <code>_ODX.json</code> are considered during a manual sync.</small></span><div class="cloud-instructions-action"><a class="secondary-button settings-compact-action cloud-instructions-button download-link-button" href="/downloads/OldDex-Cloud-Instructions.txt" download>Cloud Instructions (.txt)</a></div></div>
        <div v-if="!rosterCloudConnected" class="setting-row roster-cloud-code-row"><span><strong>Cloud Link Code</strong><small>Old.dex OAuth protection code for this browser.</small></span><div class="roster-cloud-code-controls"><code>{{ rosterCloudState.linkCode }}</code></div></div>
        <div v-if="!rosterCloudConnected" class="setting-row roster-cloud-workspace-row"><span><strong>Workspace Link</strong><small>Connect a Dropbox account. Dropbox creates and isolates the Old.dex App Folder automatically; no shared-folder URL, Workspace account, or service account is required.</small></span><div class="roster-cloud-workspace-controls"><code>Dropbox App Folder</code><button class="secondary-button settings-compact-action" type="button" :disabled="rosterCloudBusy || !rosterCloudConfig.configured" @click="connectRosterCloud">{{ rosterCloudBusy ? 'Working…' : 'Connect Dropbox' }}</button></div></div>
        <div v-if="!rosterCloudConfig.configured && !rosterCloudConnected" class="setting-row"><span><strong>Cloud Configuration</strong><small>Cloud Sync is unavailable on this deployment. No user action is required.</small></span><span class="value-chip">NOT CONFIGURED</span></div>
        <div v-else-if="rosterCloudConnection" class="setting-row"><span><strong>Dropbox App Folder</strong><small>Connected {{ new Date(rosterCloudConnection.linkedAt).toLocaleDateString() }}. Exact roster-ID matches from Dropbox replace the local copy only when Update from Cloud is clicked. Unmatched local rosters remain local.</small></span><div class="button-row roster-cloud-sync-actions"><button class="secondary-button settings-compact-action" type="button" :disabled="rosterCloudBusy" @click="updateRosterCloud">Update from Cloud</button><button class="secondary-button settings-compact-action" type="button" :disabled="rosterCloudBusy" @click="uploadRosterCloud">Upload Local</button><button class="secondary-button settings-compact-action" type="button" :disabled="rosterCloudBusy" @click="disconnectCloud">Disconnect</button></div></div>
      </div><p v-if="rosterCloudMessage" class="update-status roster-cloud-status-message">{{ rosterCloudMessage }}</p></details>

      <details class="reset-data-settings-panel"><summary><span><strong>Reset local data</strong><small>Manage saved matches, rosters, caches, favorites, and other locally stored Old.dex data.</small></span><span class="value-chip">MANAGE</span></summary><div class="reset-data-option-list">
        <div class="setting-row reset-data-row"><span><strong>Reset all local data</strong><small>Remove saved army lists, matches, favorites, cached content, and other locally added Old.dex data while preserving Display settings.</small></span><button class="secondary-button settings-compact-action" type="button" :disabled="dataResetState === 'running'" @click="resetLocalData">{{ dataResetState === 'running' ? 'Resetting…' : 'Reset data' }}</button></div>
        <div class="setting-row local-clear-row"><span><strong>Clear ongoing matches</strong><small>Remove all matches that are still in progress. Completed match history is kept.</small></span><button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('open-games')">Clear</button></div>
        <div class="setting-row local-clear-row"><span><strong>Clear match history</strong><small>Remove completed matches while keeping any ongoing matches.</small></span><button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('history')">Clear</button></div>
        <div class="setting-row local-clear-row"><span><strong>Clear friendly rosters</strong><small>Remove rosters in the normal Army Rosters section. Enemy rosters are kept.</small></span><button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('friendly-rosters')">Clear</button></div>
        <div class="setting-row local-clear-row"><span><strong>Clear enemy rosters</strong><small>Remove all rosters currently flagged as Enemy Army Rosters.</small></span><button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('enemy-rosters')">Clear</button></div>
      </div></details>
      <div class="setting-row update-setting-row"><span><strong>Update Builder rules</strong><small>Force Old.dex to discard current remote caches and request fresh Builder data plus all configured rule and army reference pages.</small></span><button class="secondary-button update-button settings-compact-action" type="button" :disabled="updateState === 'running'" @click="updateBuilderRules">{{ updateState === 'running' ? 'Updating…' : 'Update now' }}</button></div>
      <div v-if="updateMessage" class="update-status" :class="updateState">{{ updateMessage }}</div>
      <div class="setting-row static-row"><span><strong>Rule content</strong><small>Repository text is loaded into the Old.dex reader and cached locally for faster repeat lookups.</small></span><span class="value-chip">LIVE</span></div>
      <div class="setting-row static-row"><span><strong>Army data</strong><small>Remote data paths remain internal to the data adapter and are not shown in normal application screens.</small></span><span class="value-chip">REMOTE</span></div>
      <div class="setting-row custom-data-setting-row"><span><strong>Custom data</strong><small>Import an Old.dex custom-data JSON pack stored only on this device. Custom units become available when Allow Custom Units is enabled for a roster.</small></span><button class="secondary-button settings-compact-action" type="button" @click="customDataInput?.click()">Import</button><input ref="customDataInput" class="file-import-input" type="file" accept=".json,.olddex-custom.json,application/json" @change="importCustomDataFile" /></div>
      <div v-if="customDataMessage" class="update-status custom-data-status" role="status">{{ customDataMessage }}</div>
    </section></section>

    <section class="settings-group" aria-label="Changelog and updates"><div class="settings-group-heading"><p class="eyebrow settings-group-title">CHANGELOG &amp; UPDATES</p></div><section class="settings-card">
      <div class="setting-row static-row"><span><strong>Site Changelog - Alpha 0.46</strong><small>Review changes, fixes, and feature updates included in the current Old.dex build.</small></span><RouterLink to="/changelog" class="secondary-button settings-compact-action">Open</RouterLink></div>
    </section></section>
  </main>
</template>

<style scoped>
.roster-cloud-detail{align-items:stretch;flex-direction:column}.roster-cloud-detail>span{max-width:100%}.cloud-instructions-action{display:flex;justify-content:center;width:100%}.cloud-instructions-button{width:max-content;max-width:100%}.roster-data-status-pills{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-left:auto}.roster-cloud-code-controls{display:flex;align-items:center;justify-content:flex-end;min-width:0;max-width:58%}.roster-cloud-workspace-row{align-items:stretch;flex-direction:column}.roster-cloud-workspace-controls{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;max-width:100%;min-width:0;flex-wrap:wrap}.roster-cloud-code-controls code,.roster-cloud-workspace-controls code{min-width:0;overflow-wrap:anywhere;color:var(--ink);font-size:calc(9px + var(--font-offset))}.roster-cloud-sync-actions{justify-content:flex-end;flex-wrap:wrap}.roster-cloud-status-message{margin:10px 12px 12px}.cloud-sync-panel code{user-select:text;-webkit-user-select:text}@media(max-width:680px){.cloud-sync-panel .setting-row,.roster-data-panel .setting-row{align-items:stretch;flex-direction:column}.roster-data-status-pills{justify-content:flex-start;margin-left:0}.roster-cloud-code-controls{width:100%;max-width:100%;justify-content:flex-start}.roster-cloud-workspace-controls .settings-compact-action{width:100%}.roster-cloud-sync-actions{width:100%;display:grid;grid-template-columns:1fr}.roster-cloud-sync-actions .settings-compact-action{width:100%}}
</style>
