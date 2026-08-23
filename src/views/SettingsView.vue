<script setup lang="ts">
import { computed, ref } from 'vue'
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

const { darkMode, compactRows, fontSize, boldText, visualTheme, backgroundImage, reset } = useSettings()
const updateState = ref<'idle' | 'running' | 'success' | 'error'>('idle')
const updateMessage = ref('')
const dataResetState = ref<'idle' | 'running'>('idle')
const customDataInput = ref<HTMLInputElement | null>(null)
const customDataMessage = ref('')

const { installPrompt, installedApp, requestInstall: requestOldDexInstall } = useInstallApp()
async function installOldDex() {
  const result = await requestOldDexInstall()
  if (result.outcome === 'unavailable' && typeof window !== 'undefined') {
    window.alert('Use your browser menu and choose “Install app” or “Add to Home Screen” to install Old.dex on this device.')
  }
}

const themeOptions: Array<{ value: Exclude<VisualTheme, 'default'>; label: string; note: string }> = [
  { value: 'forces-of-fantasy', label: 'Forces of Fantasy', note: 'Cool blue and heraldic parchment accents.' },
  { value: 'powers-of-chaos', label: 'Powers of Chaos', note: 'Crimson, brass and dark iron accents.' },
  { value: 'legions-of-undead', label: 'Legions of Undead', note: 'Cold bone, grave-green and ancient metal accents.' },
  { value: 'ravening-hordes', label: 'Ravening Hordes', note: 'Muted green, ochre and field-parchment accents.' },
]
const currentThemeLabel = computed(() => themeOptions.find((option) => option.value === visualTheme.value)?.label || 'Default')

const backgroundOptions: Array<{ value: Exclude<BackgroundChoice, 'none'>; label: string }> = [
  { value: 'background-1', label: 'Background 1' },
  { value: 'background-2', label: 'Background 2' },
  { value: 'background-3', label: 'Background 3' },
  { value: 'background-4', label: 'Background 4' },
]
const currentBackgroundLabel = computed(() => backgroundOptions.find((option) => option.value === backgroundImage.value)?.label || 'Off')

function toggleBackground(value: Exclude<BackgroundChoice, 'none'>, event: Event) {
  const checked = Boolean((event.target as HTMLInputElement | null)?.checked)
  backgroundImage.value = checked ? value : (backgroundImage.value === value ? 'none' : backgroundImage.value)
}

function toggleVisualTheme(value: Exclude<VisualTheme, 'default'>, event: Event) {
  const checked = Boolean((event.target as HTMLInputElement | null)?.checked)
  visualTheme.value = checked ? value : (visualTheme.value === value ? 'default' : visualTheme.value)
}

function resetLocalData() {
  if (typeof window === 'undefined' || dataResetState.value === 'running') return
  const confirmed = window.confirm('Reset Old.dex local data? This removes saved army lists, favorites, cached rule/army content, and other locally added app data. Display settings and themes are preserved.')
  if (!confirmed) return
  dataResetState.value = 'running'
  storageKeys()
    .filter((key) => key.startsWith('olddex.') && !key.startsWith('olddex.settings.'))
    .forEach((key) => removeStorage(key))
  window.setTimeout(() => window.location.reload(), 120)
}

function clearLocalCategory(kind: 'open-games' | 'history' | 'friendly-rosters' | 'enemy-rosters') {
  if (typeof window === 'undefined') return
  const labels = {
    'open-games': 'all ongoing matches',
    history: 'all completed match history',
    'friendly-rosters': 'all friendly army rosters',
    'enemy-rosters': 'all enemy army rosters',
  } as const
  if (!window.confirm(`Clear ${labels[kind]} from this device? This cannot be undone.`)) return
  if (kind === 'open-games') clearSavedGamesByStatus('open')
  else if (kind === 'history') clearSavedGamesByStatus('complete')
  else if (kind === 'friendly-rosters') clearSavedArmyListsByType(false)
  else clearSavedArmyListsByType(true)
}

const fontOptions: Array<{ value: FontSize; label: string }> = [
  { value: 'smallest', label: 'Smallest' },
  { value: 'small', label: 'Smaller' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Larger' },
  { value: 'largest', label: 'Largest' },
]

const configuredRulePages = [
  ...ruleSections.filter((rule) => !nonReaderRuleSourcePaths.has(rule.sourcePath)).map((rule) => rule.sourcePath),
  ...supportPages.map((page) => page.sourcePath),
  ...battleScenarioEntries.map((scenario) => scenario.sourcePath),
  ...armies.map((army) => armySourcePath(army.slug)),
]

async function importCustomDataFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  customDataMessage.value = ''
  try {
    const result = importCustomDataJson(await file.text())
    customDataMessage.value = `${result.units} custom unit${result.units === 1 ? '' : 's'} imported from ${result.packs} data pack${result.packs === 1 ? '' : 's'}.`
  } catch (error) {
    customDataMessage.value = error instanceof Error ? error.message : 'This custom-data JSON could not be imported.'
  } finally {
    input.value = ''
  }
}

async function updateBuilderRules() {
  if (updateState.value === 'running') return
  updateState.value = 'running'
  updateMessage.value = 'Refreshing Builder data…'

  try {
    const builder = await forceRefreshBuilderData((completed, total) => {
      updateMessage.value = `Refreshing Builder data… ${completed}/${total}`
    })

    const rules = await forceRefreshRulePages(configuredRulePages, (completed, total) => {
      updateMessage.value = `Refreshing rule repository… ${completed}/${total}`
    })

    const when = new Date()
    writeStorage('olddex.lastRemoteUpdate', when.toISOString())

    if (rules.failed) {
      updateState.value = 'error'
      updateMessage.value = `Builder data refreshed. ${rules.refreshed}/${rules.total} rule pages refreshed; ${rules.failed} could not be loaded.`
      return
    }

    updateState.value = 'success'
    updateMessage.value = `Updated ${builder.refreshed} Builder data sources and ${rules.refreshed} rule pages at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  } catch (error) {
    reportAppError(error, 'SETTINGS_REMOTE_REFRESH')
    updateState.value = 'error'
    updateMessage.value = error instanceof Error ? error.message : 'Remote update failed.'
  }
}
</script>

<template>
  <main class="page settings-page">
    <AppHeader />
    <div class="page-title-block">
      <p class="eyebrow">SETTINGS</p>
      <h1>Settings</h1>
      <p>Display preferences are stored on this device. Remote Builder data and rule content can also be manually refreshed without waiting for normal cache expiry.</p>
    </div>

    <section class="settings-group" aria-label="Install Old.dex">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">INSTALL</p>
      </div>
      <section class="settings-card">
        <div class="setting-row install-setting-row">
          <span><strong>Install Old.dex</strong><small>{{ installedApp ? 'Old.dex is running as an installed app on this device.' : installPrompt ? 'Install Old.dex as an app on this phone, tablet, or computer.' : 'Old.dex is installable. If the direct prompt is unavailable, use your browser menu and choose Install app or Add to Home Screen.' }}</small></span>
          <button class="secondary-button settings-compact-action" type="button" :disabled="installedApp" @click="installOldDex">{{ installedApp ? 'Installed' : 'Install' }}</button>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Report bugs and issues">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">REPORT BUGS &amp; ISSUES</p>
      </div>
      <section class="settings-card">
        <div class="setting-row static-row support-placeholder-row">
          <span><strong>Bug &amp; issue reporting</strong><small>A direct Old.dex issue-reporting workflow will be added here in a later build.</small></span>
          <span class="value-chip">COMING SOON</span>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Display settings">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">DISPLAY</p>
      </div>
      <section class="settings-card">
        <label class="setting-row">
          <span><strong>Dark mode</strong><small>The same theme setting controlled by the light/dark button in the top-right header.</small></span>
          <input v-model="darkMode" type="checkbox" />
        </label>
        <label class="setting-row">
          <span><strong>Compact rows</strong><small>Reduce list and reference row height throughout Old.dex.</small></span>
          <input v-model="compactRows" type="checkbox" />
        </label>
        <div class="setting-row">
          <span><strong>Text size</strong><small>Choose from two steps below or above the normal interface text size. Normal uses the original site-wide interface scale; the enlarged Old.dex header is independent of this setting.</small></span>
          <div class="font-size-control" role="group" aria-label="Text size">
            <button
              v-for="option in fontOptions"
              :key="option.value"
              type="button"
              :class="{ active: fontSize === option.value }"
              @click="fontSize = option.value"
            >{{ option.label }}</button>
          </div>
        </div>
        <label class="setting-row">
          <span><strong>Bold text</strong><small>Increase the weight of normal interface and reference text.</small></span>
          <input v-model="boldText" type="checkbox" />
        </label>
        <details class="theme-settings-panel">
          <summary>
            <span><strong>Themes</strong><small>Faction themes change the Old.dex palette while preserving the selected light or dark mode.</small></span>
            <span class="value-chip">{{ currentThemeLabel }}</span>
          </summary>
          <div class="theme-option-list">
            <label v-for="theme in themeOptions" :key="theme.value" class="theme-option-row setting-row">
              <span><strong>{{ theme.label }}</strong><small>{{ theme.note }}</small></span>
              <input :checked="visualTheme === theme.value" type="checkbox" @change="toggleVisualTheme(theme.value, $event)" />
            </label>
          </div>
        </details>
        <details class="background-settings-panel">
          <summary>
            <span><strong>Backgrounds</strong><small>Use one fixed background image behind Old.dex. The image stays centered as you move through the application.</small></span>
            <span class="value-chip">{{ currentBackgroundLabel }}</span>
          </summary>
          <div class="background-option-list">
            <label v-for="background in backgroundOptions" :key="background.value" class="background-option-row setting-row">
              <span class="background-option-copy"><span class="background-preview" :class="background.value" aria-hidden="true"></span><strong>{{ background.label }}</strong></span>
              <input :checked="backgroundImage === background.value" type="checkbox" @change="toggleBackground(background.value, $event)" />
            </label>
          </div>
        </details>
        <div class="setting-row reset-setting-row">
          <span><strong>Reset local settings</strong><small>Restore the display preferences on this device to their defaults.</small></span>
          <button class="secondary-button settings-compact-action" type="button" @click="reset">Reset</button>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Support">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">SUPPORT</p>
      </div>
      <section class="settings-card support-settings-card">
        <div class="setting-row static-row support-copy-row">
          <span><strong>Support Old.dex</strong><small>Voluntary Support for Old.Dex – Not Affiliated with Games Workshop – Contributions Used Only for Domain and Hosting Costs</small></span>
        </div>
        <div class="support-button-row" aria-label="Old.dex support options">
          <a class="secondary-button support-action-button" href="https://buy.stripe.com/7sY9ATaA64LEf2Adzz3Nm02" target="_blank" rel="noopener noreferrer">One Time Gift</a>
          <a class="secondary-button support-action-button" href="https://buy.stripe.com/4gM5kDbEa6TM9Ig7bb3Nm03" target="_blank" rel="noopener noreferrer">Recurring Gift</a>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Data and content settings">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">DATA &amp; CONTENT</p>
      </div>
      <section class="settings-card">
        <details class="reset-data-settings-panel">
          <summary>
            <span><strong>Reset local data</strong><small>Manage saved matches, rosters, caches, favorites, and other locally stored Old.dex data.</small></span>
            <span class="value-chip">MANAGE</span>
          </summary>
          <div class="reset-data-option-list">
            <div class="setting-row reset-data-row">
              <span><strong>Reset all local data</strong><small>Remove saved army lists, matches, favorites, cached content, and other locally added Old.dex data while preserving Display settings.</small></span>
              <button class="secondary-button settings-compact-action" type="button" :disabled="dataResetState === 'running'" @click="resetLocalData">{{ dataResetState === 'running' ? 'Resetting…' : 'Reset data' }}</button>
            </div>
            <div class="setting-row local-clear-row">
              <span><strong>Clear ongoing matches</strong><small>Remove all matches that are still in progress. Completed match history is kept.</small></span>
              <button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('open-games')">Clear</button>
            </div>
            <div class="setting-row local-clear-row">
              <span><strong>Clear match history</strong><small>Remove completed matches while keeping any ongoing matches.</small></span>
              <button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('history')">Clear</button>
            </div>
            <div class="setting-row local-clear-row">
              <span><strong>Clear friendly rosters</strong><small>Remove rosters in the normal Army Rosters section. Enemy rosters are kept.</small></span>
              <button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('friendly-rosters')">Clear</button>
            </div>
            <div class="setting-row local-clear-row">
              <span><strong>Clear enemy rosters</strong><small>Remove all rosters currently flagged as Enemy Army Rosters.</small></span>
              <button class="secondary-button settings-compact-action" type="button" @click="clearLocalCategory('enemy-rosters')">Clear</button>
            </div>
          </div>
        </details>
        <div class="setting-row update-setting-row">
          <span><strong>Update Builder rules</strong><small>Force Old.dex to discard current remote caches and request fresh Builder data plus all configured rule and army reference pages.</small></span>
          <button class="secondary-button update-button settings-compact-action" type="button" :disabled="updateState === 'running'" @click="updateBuilderRules">
            {{ updateState === 'running' ? 'Updating…' : 'Update now' }}
          </button>
        </div>
        <div v-if="updateMessage" class="update-status" :class="updateState">{{ updateMessage }}</div>
        <div class="setting-row static-row">
          <span><strong>Rule content</strong><small>Repository text is loaded into the Old.dex reader and cached locally for faster repeat lookups.</small></span>
          <span class="value-chip">LIVE</span>
        </div>
        <div class="setting-row static-row">
          <span><strong>Army data</strong><small>Remote data paths remain internal to the data adapter and are not shown in normal application screens.</small></span>
          <span class="value-chip">REMOTE</span>
        </div>
        <div class="setting-row custom-data-setting-row">
          <span><strong>Custom data</strong><small>Import an Old.dex custom-data JSON pack stored only on this device. Custom units become available when Allow Custom Units is enabled for a roster.</small></span>
          <button class="secondary-button settings-compact-action" type="button" @click="customDataInput?.click()">Import</button>
          <input ref="customDataInput" class="file-import-input" type="file" accept=".json,.olddex-custom.json,application/json" @change="importCustomDataFile" />
        </div>
        <div v-if="customDataMessage" class="update-status custom-data-status" role="status">{{ customDataMessage }}</div>
      </section>
    </section>
  </main>
</template>
