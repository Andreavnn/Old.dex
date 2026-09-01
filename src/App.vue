<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useSettings } from './settings'
import { initializeBuilderData } from './services/armyData'
import { reportAppError } from './services/appErrors'
import { openOldDexIssueReport } from './services/siteReport'
import { OLDDEX_BUILD_LABEL } from './version'
import { useInstallApp } from './services/installApp'
import { loadOwbRuleCatalog } from './services/owbRuleResolver'
import { OLDDEX_DISCORD_URL, shareOldDex } from './services/siteShare'

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
function reportIssue() { openOldDexIssueReport() }
function openDiscord() { if (typeof window !== 'undefined') window.open(OLDDEX_DISCORD_URL, '_blank', 'noopener,noreferrer') }
async function shareSite() {
  const result = await shareOldDex()
  if (!result.ok && result.message !== 'Share cancelled.' && typeof window !== 'undefined') window.alert(result.message)
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
        <div><strong>OLD.DEX</strong><small>{{ OLDDEX_BUILD_LABEL.toUpperCase() }}</small></div>
      </section>
    </Transition>

    <RouterView />
    <section v-if="showGlobalPageTools" class="page-utility-shell" aria-label="Old.dex page tools">
      <div class="page-utility-actions">
        <button type="button" class="secondary-button footer-tool-button" @click="reportIssue">Report</button>
        <button type="button" class="secondary-button footer-tool-button" @click="openDiscord">Discord</button>
        <button type="button" class="secondary-button footer-tool-button" @click="shareSite">Share</button>
        <button type="button" class="secondary-button footer-tool-button" :disabled="installedApp" @click="installFromFooter">{{ installedApp ? 'Installed' : 'Install Old.dex' }}</button>
      </div>
    </section>

    <footer v-if="showGlobalPageTools" class="app-footer olddex-legal-footer">
      <span>Old.dex {{ OLDDEX_BUILD_LABEL }}</span>
      <span>Olddex is not affiliated with Games Workshop. It displays data from BSData.</span>
    </footer>
  </div>
</template>

<style>
/* Match layout polish, chart navigation, and popup refinements. */
.app-shell button { text-align: center; }
.app-shell :is(.secondary-button,.primary-button,.danger-button,.match-general-tool,.match-tab-scroll-arrow,.games-search-toggle,.game-row-action,.saved-list-action-button,.saved-list-icon-action,.builder-mini-action) {
  align-items: center;
  justify-content: center;
  text-align: center;
}
.app-shell a:is(.secondary-button,.primary-button,.danger-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.app-shell .game-match-page :is(
  .game-length-card,
  .condition-resolution-panel,
  .battle-step-tip,
  .scenario-priority-panel,
  .game-tip-card,
  .overview-battlefield-panel,
  .overview-composition-options,
  .overview-magic-panel,
  .deployment-guidance-panel,
  .deployment-order-panel,
  .deployment-first-turn-window,
  .game-first-turn-window,
  .start-round-rule-panel,
  .turn-guidance-panel,
  .match-procedure-panel,
  .deployment-roster-panel,
  .end-round-score-content
) {
  padding-left: clamp(14px, 2.6vw, 18px);
  padding-right: clamp(14px, 2.6vw, 18px);
}
.app-shell .game-match-page :is(.game-length-card,.condition-resolution-panel,.battle-step-tip,.scenario-priority-panel) > :first-child {
  margin-top: 0;
}
.app-shell :is(.game-length-card,.condition-resolution-panel) > :is(h2,h3,p,.eyebrow) {
  margin-left: 0;
  margin-right: 0;
}

.app-shell .combined-phase-tabs .phase-parent-tab,
.app-shell .combined-phase-tabs .phase-inline-step,
.app-shell .combined-phase-tabs .phase-parent-tab:visited,
.app-shell .combined-phase-tabs .phase-inline-step:visited {
  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
  opacity: 1;
}
.app-shell .combined-phase-tabs :is(.phase-parent-tab,.phase-inline-step).active {
  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
}
.app-shell .combined-phase-tabs :is(.phase-parent-tab,.phase-inline-step):disabled {
  color: var(--ink-soft);
  -webkit-text-fill-color: var(--ink-soft);
  opacity: .65;
}

.app-shell .battle-chart-arrow-shell {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: stretch;
  gap: 7px;
  padding: 12px;
}
.app-shell .battle-chart-arrow {
  display: grid;
  place-items: center;
  min-width: 42px;
  border: 1px solid var(--line-dark);
  border-radius: 9px;
  background: var(--paper-2);
  color: var(--ink);
  cursor: pointer;
}
.app-shell .battle-chart-arrow:hover {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.app-shell .battle-chart-arrow svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.app-shell .battle-chart-arrow-shell .battle-chart-scroll { padding: 0; }
.app-shell .ballistic-chart-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  scroll-behavior: smooth;
}
.app-shell .ballistic-chart-scroll::-webkit-scrollbar { display: none; }

.match-export-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, .58);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.match-export-backdrop .match-export-modal {
  width: min(620px, calc(100vw - 40px));
  max-height: min(88dvh, 760px);
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
}
.match-export-backdrop .match-export-modal > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.match-export-backdrop .match-export-modal h2 { margin: 0; }
.match-export-backdrop .match-export-options { margin: 16px 0; }
.match-export-backdrop :is(.secondary-button,.primary-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.app-shell .match-roster-heading { align-items: stretch; }
.app-shell .match-roster-heading > div:first-child { min-width: 0; }
.app-shell .match-roster-heading-actions {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  min-width: max-content;
}
.app-shell .match-roster-heading-actions .secondary-button { margin-top: auto; }
.app-shell .match-roster-heading-actions > strong { align-self: flex-end; }

@media (max-width: 720px) {
  .app-shell .battle-chart-arrow-shell {
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    gap: 5px;
    padding: 9px;
  }
  .app-shell .battle-chart-arrow { min-width: 36px; }
  .match-export-backdrop { padding: 10px; }
  .match-export-backdrop .match-export-modal {
    width: min(620px, calc(100vw - 20px));
    max-height: calc(100dvh - 20px);
    padding: 16px;
  }
}
@media (max-width: 520px) {
  .app-shell .match-roster-heading {
    flex-direction: row;
    align-items: stretch;
  }
  .app-shell .match-roster-heading-actions { min-width: 118px; }
  .app-shell .match-roster-heading-actions .secondary-button {
    white-space: normal;
    line-height: 1.2;
    padding-inline: 10px;
  }
}
</style>
