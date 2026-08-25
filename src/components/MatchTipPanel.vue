<script setup lang="ts">
import { RouterLink } from 'vue-router'

const props = defineProps<{
  title: string
  text: string
  collapsed?: boolean
  ruleTo?: string
  ruleLabel?: string
}>()
const emit = defineEmits<{ toggle: [checked: boolean] }>()

function handleToggle(event: Event) {
  emit('toggle', Boolean((event.target as HTMLInputElement).checked))
}
</script>

<template>
  <aside class="game-tip-card match-tip-card" :class="{ collapsed: props.collapsed }">
    <span class="game-tip-icon">i</span>
    <div class="match-tip-copy">
      <div class="match-tip-title-row">
        <strong>{{ title }}</strong>
        <input
          class="match-tip-collapse-check"
          type="checkbox"
          :checked="Boolean(collapsed)"
          aria-label="Collapse this tip"
          title="Collapse this tip"
          @change="handleToggle"
        />
      </div>
      <template v-if="!collapsed">
        <p>{{ text }}</p>
        <RouterLink v-if="ruleTo" :to="ruleTo">{{ ruleLabel || 'Open rules' }}</RouterLink>
      </template>
    </div>
  </aside>
</template>
