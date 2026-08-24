<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useSettings } from '../settings'

const { bootAudioEnabled } = useSettings()
const ready = ref(false)

onMounted(() => {
  void nextTick(() => { ready.value = Boolean(document.querySelector('.settings-page .settings-group[aria-label="Install Old.dex"] .settings-card')) })
})
</script>

<template>
  <Teleport v-if="ready" to=".settings-page .settings-group[aria-label='Install Old.dex'] .settings-card">
    <label class="setting-row boot-audio-setting-row">
      <span>
        <strong>Installed app launch audio</strong>
        <small>Play the Old.dex boot sound during the launch scene when Old.dex is opened as an installed app. Browser-tab launches remain silent.</small>
      </span>
      <input v-model="bootAudioEnabled" type="checkbox" />
    </label>
  </Teleport>
</template>
