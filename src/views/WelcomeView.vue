<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dismissWelcomeInstallPromptPermanently, hasDismissedWelcomeInstallPrompt, markWelcomeSeen } from '../services/welcome'
import { useInstallApp } from '../services/installApp'

const route = useRoute()
const router = useRouter()
const installModalOpen = ref(!hasDismissedWelcomeInstallPrompt())
const installHelp = ref(false)
const { canInstall, installedApp, requestInstall } = useInstallApp()

const continuePath = computed(() => {
  const candidate = String(route.query.continue || '')
  return candidate.startsWith('/') && !candidate.startsWith('/welcome') ? candidate : '/lists'
})

async function installNow() {
  const result = await requestInstall()
  if (result.outcome === 'unavailable') {
    installHelp.value = true
    return
  }
  if (result.outcome === 'accepted' || result.outcome === 'installed') installModalOpen.value = false
}

function dismissInstall() { installModalOpen.value = false }
function dismissInstallPermanently() { dismissWelcomeInstallPromptPermanently(); installModalOpen.value = false }
function continueToOldDex() {
  markWelcomeSeen()
  void router.replace(continuePath.value)
}
</script>

<template>
  <main class="welcome-page">
    <section class="welcome-panel card-surface">
      <header class="welcome-brand-block">
        <img src="/icons/icon-192.png" alt="Old.dex crest" class="welcome-icon" />
        <div>
          <p class="eyebrow">WELCOME TO</p>
          <h1>OLD.DEX</h1>
          <p class="welcome-tagline">A companion for building armies, checking rules, and running games of Warhammer: The Old World.</p>
        </div>
      </header>

      <section class="welcome-intro-grid">
        <article>
          <h2>Army Rosters</h2>
          <p>Create and import rosters, review model profiles, track list validity, and keep friendly and enemy forces organized on the device you are using.</p>
        </article>
        <article>
          <h2>Rules Reference</h2>
          <p>Browse Old World rules and army references without leaving the app. Old.dex links related rules together where the source data allows it.</p>
        </article>
        <article>
          <h2>Game Companion</h2>
          <p>Prepare a match, record spells and battlefield information, and work through the battle sequence with contextual reminders and tips.</p>
        </article>
      </section>

      <section class="welcome-support-block">
        <div>
          <p class="eyebrow">SUPPORT</p>
          <h2>Keeping Old.dex online</h2>
          <p>Old.dex is free to use. Voluntary support is used only for domain and hosting costs.</p>
        </div>
        <div class="welcome-support-actions" aria-label="Support Old.dex">
          <a class="secondary-button welcome-support-button" href="https://buy.stripe.com/eVq7sL0Zw2DwdYwcvv3Nm01" target="_blank" rel="noopener noreferrer">One Time Gift</a>
          <a class="secondary-button welcome-support-button" href="https://buy.stripe.com/fZu8wP4bI2Dw6w4cvv3Nm00" target="_blank" rel="noopener noreferrer">Recurring Gift</a>
        </div>
      </section>

      <section class="welcome-thanks-block">
        <p class="eyebrow">SPECIAL THANKS</p>
        <h2>Built with help from the community</h2>
        <div class="welcome-thanks-list">
          <a href="https://www.whfb.app/" target="_blank" rel="noopener noreferrer">Warhammer Fantasy Online Rules Index Project</a>
          <strong>Nico Thiebes</strong>
          <span>Sig.dex</span>
          <span>Other Contributing Supporters</span>
        </div>
      </section>

      <aside class="welcome-disclaimer">
        <strong>Unofficial fan project</strong>
        <p>Old.dex is an independent, fan-made tool and is not affiliated with, endorsed by, or sponsored by Games Workshop. Warhammer, Warhammer: The Old World, associated names, imagery, rules, and trademarks belong to their respective owners. Old.dex exists to help players organize and reference the game they already own.</p>
      </aside>

      <button type="button" class="primary-button welcome-enter-button" @click="continueToOldDex">Enter Old.dex</button>
    </section>

    <div v-if="installModalOpen && !installedApp" class="welcome-install-backdrop" role="presentation">
      <section class="welcome-install-dialog card-surface" role="dialog" aria-modal="true" aria-labelledby="welcome-install-title">
        <img src="/icons/favicon-64.png" alt="" aria-hidden="true" />
        <div>
          <p class="eyebrow">INSTALL OLD.DEX</p>
          <h2 id="welcome-install-title">Use Old.dex like an app?</h2>
          <p>Install Old.dex on this phone, tablet, or computer for a home-screen or desktop icon and a standalone app window.</p>
          <p v-if="installHelp" class="install-help-copy">Your browser has not exposed the direct install prompt yet. Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>
        </div>
        <div class="welcome-install-actions">
          <button type="button" class="primary-button" @click="installNow">{{ canInstall ? 'Install Old.dex' : 'Install options' }}</button>
          <button type="button" class="secondary-button" @click="dismissInstall">Not now</button>
          <button type="button" class="secondary-button welcome-install-never" @click="dismissInstallPermanently">Do not show again</button>
        </div>
      </section>
    </div>
  </main>
</template>
