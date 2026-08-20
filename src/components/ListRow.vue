<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  subtitle?: string
  to?: string
  href?: string
  badge?: string
  muted?: boolean
}>()
</script>

<template>
  <component
    :is="to ? RouterLink : href ? 'a' : 'div'"
    :to="to"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noreferrer' : undefined"
    class="list-row"
    :class="{ muted }"
  >
    <div class="list-row-copy">
      <span class="list-row-title">{{ title }}</span>
      <span v-if="subtitle" class="list-row-subtitle">{{ subtitle }}</span>
    </div>
    <span v-if="badge" class="row-badge">{{ badge }}</span>
    <svg v-else-if="to || href" class="row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
  </component>
</template>
