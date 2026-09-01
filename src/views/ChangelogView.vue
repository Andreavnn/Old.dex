<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { changelogEntries, type ChangelogEntry } from '../data/changelog'

const alpha053: ChangelogEntry = {
  version: '0.53',
  title: 'Match layout, export, chart navigation, and General’s Bar corrections',
  notes: [
    'Corrected recurring Match panel edge spacing so text and controls retain a consistent interior gutter.',
    'Restored readable phase-bar titles and active phase/subphase label contrast across themes.',
    'Replaced the Ballistic Skill chart scrollbar with explicit left and right navigation arrows while preserving touch and trackpad scrolling.',
    'Converted Match Export into a true modal popup with backdrop, contained scrolling, and close behavior.',
    'Standardized action-label centering across shared buttons and Match controls.',
    'Repositioned the Match Roster Back to Match control to the lower-right of the roster heading area.',
    'Changed active Reference Sheet, Battle Charts, and Roster General’s Bar tools to return directly to the current match.',
    'Updated runtime, package, PWA cache, README, and visible changelog metadata to Alpha Build 0.53.',
  ],
}
const visibleChangelogEntries: ChangelogEntry[] = [alpha053, ...changelogEntries]
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
