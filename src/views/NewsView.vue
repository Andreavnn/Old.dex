<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { changelogEntries } from '../data/changelog'
const latest = changelogEntries[0]
</script>

<template>
  <main class="page news-page">
    <AppHeader />
    <div class="page-title-block"><h1>News</h1><p>Old.dex development and release updates.</p></div>
    <section v-if="latest" class="card-surface news-latest-card">
      <p class="eyebrow">LATEST BUILD</p>
      <h2>Alpha Build {{ latest.version }} — {{ latest.title }}</h2>
      <ul><li v-for="note in latest.notes" :key="note">{{ note }}</li></ul>
      <RouterLink class="secondary-button" to="/changelog">Open Changelog</RouterLink>
    </section>
  </main>
</template>
