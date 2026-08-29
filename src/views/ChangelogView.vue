<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { changelogEntries } from '../data/changelog'
const visibleChangelogEntries = changelogEntries
</script>

<template>
  <main class="page changelog-page">
    <AppHeader compact back-to="/lists" prefer-back-to />
    <div class="page-title-block">
      <p class="eyebrow">BUILD HISTORY</p>
      <h1>Changelog</h1>
      <p>Canonical Old.dex alpha history. Duplicate iterations are consolidated into the build where the behavior became part of the application source.</p>
    </div>

    <section class="changelog-stack" aria-label="Old.dex changelog">
      <details v-for="entry in visibleChangelogEntries" :key="entry.version" class="changelog-entry card-surface" :open="entry === visibleChangelogEntries[0]">
        <summary>
          <span><strong>Alpha Build {{ entry.version }}</strong><small>{{ entry.title }}</small></span>
          <span class="changelog-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="changelog-body">
          <ul><li v-for="note in entry.notes" :key="note">{{ note }}</li></ul>
        </div>
      </details>
    </section>
  </main>
</template>
