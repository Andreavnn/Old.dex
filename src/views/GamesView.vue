<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
  <main class="page games-hold-page">
    <AppHeader />
    <div class="page-title-block">
      <p class="eyebrow">GAMES</p>
      <h1>Games</h1>
      <p>This section is being held for the future in-game workflow. It remains separate from Rules and Army Lists so the battle assistant can be added without complicating the reference browser.</p>
    </div>

    <section class="empty-state card-surface games-hold-card">
      <div class="empty-icon">⚔</div>
      <h2>No active games</h2>
      <p>When the game workflow is started, this page will hold active and recent games and launch the table-side view from an existing army list.</p>
      <button class="primary-button disabled-look" type="button" disabled>Start a game</button>
    </section>
  </main>
</template>
