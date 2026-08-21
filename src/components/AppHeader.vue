<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import PrimaryNav from './PrimaryNav.vue'
import { useSettings } from '../settings'

const props = defineProps<{ compact?: boolean; backTo?: string; backLabel?: string; preferBackTo?: boolean; skipBackPrefix?: string }>()
const router = useRouter()
const { darkMode, toggleTheme } = useSettings()

function goBack() {
  const previous = typeof window !== 'undefined' ? String(window.history.state?.back || '') : ''
  if (props.backTo && props.skipBackPrefix && previous.startsWith(props.skipBackPrefix)) void router.push(props.backTo)
  else if (props.preferBackTo && props.backTo) void router.push(props.backTo)
  else if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else if (props.backTo) void router.push(props.backTo)
}
</script>

<template>
  <header class="app-header-wrap">
    <div class="wip-banner" role="status">Old.dex is a work in progress. Some features may be incomplete or produce errors.</div>
    <div class="app-header" :class="{ compact }">
      <button v-if="backTo" type="button" class="icon-button back-button" :aria-label="backLabel || 'Back'" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg>
      </button>
      <div v-else class="header-spacer"></div>

      <div class="brand-stack">
        <RouterLink to="/lists" class="brand" aria-label="Old.dex Army Lists">
          <span class="brand-wordmark"><span class="brand-old">OLD</span><span class="brand-dot">.</span><span class="brand-dex">DEX</span></span>
          <small class="alpha-build">ALPHA BUILD 0.64</small>
        </RouterLink>
        <RouterLink to="/changelog" class="changelog-link">Changelog</RouterLink>
      </div>

      <button class="icon-button theme-button" type="button" :aria-label="darkMode ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
        <svg v-if="darkMode" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
        </svg>
      </button>
    </div>
    <PrimaryNav />
  </header>
</template>
