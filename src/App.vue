<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useSettings } from './settings'
import { initializeBuilderData } from './services/armyData'
import { reportAppError } from './services/appErrors'
import { useInstallApp } from './services/installApp'
import { useLanguagePreference } from './services/language'
import { loadOwbRuleCatalog } from './services/owbRuleResolver'

useSettings()
const route = useRoute()
const { installedApp, canInstall, requestInstall } = useInstallApp()
const { language, languageOptions } = useLanguagePreference()
const showGlobalPageTools = computed(() => route.name !== 'welcome')

async function installFromFooter() {
  const result = await requestInstall()
  if (result.outcome === 'unavailable' && typeof window !== 'undefined') {
    window.alert('Use your browser menu and choose “Install app” or “Add to Home Screen” to install Old.dex on this device.')
  }
}
function reportPlaceholder() {
  if (typeof window !== 'undefined') window.alert('Old.dex reporting is being prepared. This button will open the reporting workflow in a later update.')
}

onMounted(() => {
  Promise.all([initializeBuilderData(), loadOwbRuleCatalog()]).catch((error) => {
    reportAppError(error, 'BUILDER_STARTUP_FAILED')
  })
})
</script>

<template>
  <div class="app-shell">
    <RouterView />

    <section v-if="showGlobalPageTools" class="page-utility-shell" aria-label="Old.dex page tools">
      <div class="page-utility-actions">
        <button type="button" class="secondary-button footer-tool-button" @click="reportPlaceholder">Report</button>
        <button type="button" class="secondary-button footer-tool-button" :disabled="installedApp" @click="installFromFooter">{{ installedApp ? 'Installed' : 'Install Old.dex' }}</button>
      </div>
      <nav class="footer-language-options" aria-label="Language preference">
        <span>Language</span>
        <button v-for="option in languageOptions" :key="option.code" type="button" :class="{ active: language === option.code }" :aria-pressed="language === option.code" :title="option.label" @click="language = option.code">{{ option.short }}</button>
      </nav>
    </section>

    <footer class="app-footer">
      <span>Old.dex Alpha Build 0.64</span>
    </footer>
  </div>
</template>
