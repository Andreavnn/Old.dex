<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useSettings } from './settings'
import { initializeBuilderData } from './services/armyData'
import { reportAppError } from './services/appErrors'

useSettings()

onMounted(() => {
  initializeBuilderData().catch((error) => {
    reportAppError(error, 'BUILDER_STARTUP_FAILED')
  })
})
</script>

<template>
  <div class="app-shell">
    <RouterView />
    <footer class="app-footer">
      <span>Old.dex Alpha Build 0.61</span>
    </footer>
  </div>
</template>
