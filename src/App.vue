<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useSettings } from './settings'
import { initializeBuilderData } from './services/armyData'
import { reportAppError } from './services/appErrors'
import { useInstallApp } from './services/installApp'
import { loadOwbRuleCatalog } from './services/owbRuleResolver'

useSettings()
const route = useRoute()
const { installedApp, requestInstall } = useInstallApp()
const showGlobalPageTools = computed(() => route.name !== 'welcome')

let rulesObserver: MutationObserver | null = null
function patchRulesIntro() {
  if (typeof document === 'undefined' || route.name !== 'rules') return
  const intro = document.querySelector<HTMLElement>('.rules-intro-copy')
  if (!intro) return
  const welcome = Array.from(intro.querySelectorAll('p')).find((row) => /Welcome to the Old\.dex army builder/i.test(row.textContent || ''))
  welcome?.remove()
  const versionNote = intro.querySelector<HTMLElement>('.rules-version-note') || intro.querySelector<HTMLElement>('p')
  if (!versionNote || versionNote.querySelector('.rules-reference-links')) return
  const span = document.createElement('span')
  span.className = 'rules-reference-links'
  span.append(document.createTextNode(' The complete index of unofficial rules '))
  const index = document.createElement('a'); index.href = 'https://tow.whfb.app/'; index.target = '_blank'; index.rel = 'noreferrer'; index.innerHTML = '<strong>Warhammer: The Old World Online Rules Index</strong>'
  span.append(index, document.createTextNode(', and official '))
  const faq = document.createElement('a'); faq.href = '/rules/read/faq'; faq.innerHTML = '<strong>Frequently Asked Questions</strong>'
  const errata = document.createElement('a'); errata.href = '/rules/read/errata'; errata.innerHTML = '<strong>Errata & Amendments</strong>'
  span.append(faq, document.createTextNode(' and '), errata, document.createTextNode(' are also available.'))
  versionNote.append(span)
}
function syncRulesIntroPatch() {
  rulesObserver?.disconnect(); rulesObserver = null
  if (route.name !== 'rules' || typeof document === 'undefined') return
  void nextTick(() => {
    patchRulesIntro()
    const host = document.querySelector('.app-shell')
    if (host) { rulesObserver = new MutationObserver(patchRulesIntro); rulesObserver.observe(host, { childList: true, subtree: true }) }
  })
}
watch(() => route.name, syncRulesIntroPatch, { immediate: true })
onBeforeUnmount(() => rulesObserver?.disconnect())

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
    </section>

    <footer v-if="showGlobalPageTools" class="app-footer olddex-legal-footer">
      <span>Old.dex Alpha Build 0.33</span>
      <span>Olddex is not affiliated with Games Workshop. It displays data from BSData.</span>
    </footer>
  </div>
</template>
