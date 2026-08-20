<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useSettings, type FontSize } from '../settings'
import { forceRefreshBuilderData } from '../services/armyData'
import { forceRefreshRulePages } from '../services/ruleContent'
import { armies } from '../data/armies'
import { battleScenarioEntries, nonReaderRuleSourcePaths, ruleSections, supportPages } from '../data/rules'
import { armySourcePath } from '../data/ruleRepository'
import { writeStorage } from '../services/storage'
import { reportAppError } from '../services/appErrors'

const { darkMode, compactRows, fontSize, boldText, reset } = useSettings()
const updateState = ref<'idle' | 'running' | 'success' | 'error'>('idle')
const updateMessage = ref('')

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
          <span><strong>Text size</strong><small>Choose from two steps below or above the normal interface text size. Normal is one pixel larger than the previous default.</small></span>
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
        <div class="setting-row static-row support-placeholder-row">
          <span><strong>Themes</strong><small>Additional Old.dex visual themes will be added here in a later build.</small></span>
          <span class="value-chip">COMING SOON</span>
        </div>
        <div class="setting-row reset-setting-row">
          <span><strong>Reset local settings</strong><small>Restore the display preferences on this device to their defaults.</small></span>
          <button class="secondary-button settings-compact-action" type="button" @click="reset">Reset</button>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Donations">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">DONATIONS</p>
      </div>
      <section class="settings-card">
        <div class="setting-row static-row support-placeholder-row">
          <span><strong>Support Old.dex</strong><small>A voluntary donation/support option will be added here later. No payment functionality is active in this build.</small></span>
          <span class="value-chip">COMING SOON</span>
        </div>
      </section>
    </section>

    <section class="settings-group" aria-label="Data and content settings">
      <div class="settings-group-heading">
        <p class="eyebrow settings-group-title">DATA &amp; CONTENT</p>
      </div>
      <section class="settings-card">
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
          <span><strong>Custom data</strong><small>Upload custom armies, units, rules, and related Old.dex datasets. Import support will be enabled in a later build.</small></span>
          <button class="secondary-button settings-compact-action" type="button" disabled title="Custom data import is not enabled yet">Upload</button>
        </div>
      </section>
    </section>
  </main>
</template>
