<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useSettings } from './settings'
import { initializeBuilderData } from './services/armyData'
import { reportAppError } from './services/appErrors'
import { useInstallApp } from './services/installApp'
import { loadOwbRuleCatalog } from './services/owbRuleResolver'
import BootAudioSetting from './components/BootAudioSetting.vue'

const { bootAudioEnabled } = useSettings()
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
const launchSceneVisible = ref(false)
const launchAudioElement = ref<HTMLAudioElement | null>(null)
let launchSceneTimer = 0
let launchAudio: HTMLAudioElement | null = null
let launchAudioRetryArmed = false

function isStandaloneLaunch() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function disarmLaunchAudioRetry() {
  if (!launchAudioRetryArmed || typeof window === 'undefined') return
  launchAudioRetryArmed = false
  window.removeEventListener('pointerdown', retryLaunchAudio)
  window.removeEventListener('keydown', retryLaunchAudio)
}

function retryLaunchAudio() {
  if (!launchSceneVisible.value || !bootAudioEnabled.value || !launchAudio) { disarmLaunchAudioRetry(); return }
  void launchAudio.play().then(disarmLaunchAudioRetry).catch(() => { /* A later user gesture may still unlock audio. */ })
}

function armLaunchAudioRetry() {
  if (launchAudioRetryArmed || typeof window === 'undefined') return
  launchAudioRetryArmed = true
  window.addEventListener('pointerdown', retryLaunchAudio, { passive: true })
  window.addEventListener('keydown', retryLaunchAudio)
}

function startInstalledLaunchScene() {
  if (!isStandaloneLaunch() || typeof window === 'undefined') return
  // The launch scene is itself the trigger: whenever an installed-app load shows
  // this screen, the selected boot audio is attempted at the same time. Do not
  // suppress later standalone launches with sessionStorage/reload heuristics.
  launchSceneVisible.value = true
  void nextTick(() => {
    if (!bootAudioEnabled.value) return
    launchAudio = launchAudioElement.value || new Audio('/audio/ready_for_murderin_orc.mp3')
    launchAudio.preload = 'auto'
    launchAudio.volume = 0.9
    launchAudio.currentTime = 0
    void launchAudio.play().catch(() => armLaunchAudioRetry())
  })
  launchSceneTimer = window.setTimeout(() => { launchSceneVisible.value = false; disarmLaunchAudioRetry() }, 2300)
}

onBeforeUnmount(() => {
  rulesObserver?.disconnect()
  if (launchSceneTimer) window.clearTimeout(launchSceneTimer)
  disarmLaunchAudioRetry()
  launchAudio?.pause()
  launchAudio = null
})

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
  startInstalledLaunchScene()
  Promise.all([initializeBuilderData(), loadOwbRuleCatalog()]).catch((error) => {
    reportAppError(error, 'BUILDER_STARTUP_FAILED')
  })
})
</script>

<template>
  <div class="app-shell">
    <Transition name="olddex-launch-fade">
      <section v-if="launchSceneVisible" class="olddex-launch-scene" aria-label="Old.dex launching">
        <audio v-if="bootAudioEnabled" ref="launchAudioElement" src="/audio/ready_for_murderin_orc.mp3" preload="auto" autoplay playsinline></audio>
        <img src="/icons/icon-192.png" alt="" aria-hidden="true" />
        <div><strong>OLD.DEX</strong><small>ALPHA BUILD 0.42</small></div>
      </section>
    </Transition>

    <RouterView />
    <BootAudioSetting v-if="route.name === 'settings'" />

    <section v-if="showGlobalPageTools" class="page-utility-shell" aria-label="Old.dex page tools">
      <div class="page-utility-actions">
        <button type="button" class="secondary-button footer-tool-button" @click="reportPlaceholder">Report</button>
        <button type="button" class="secondary-button footer-tool-button" :disabled="installedApp" @click="installFromFooter">{{ installedApp ? 'Installed' : 'Install Old.dex' }}</button>
      </div>
    </section>

    <footer v-if="showGlobalPageTools" class="app-footer olddex-legal-footer">
      <span>Old.dex Alpha Build 0.42</span>
      <span>Olddex is not affiliated with Games Workshop. It displays data from BSData.</span>
    </footer>
  </div>
</template>
