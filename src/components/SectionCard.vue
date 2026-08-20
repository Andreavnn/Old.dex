<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  count?: number
  startOpen?: boolean
  open?: boolean
}>(), { startOpen: true })

const emit = defineEmits<{ toggle: [] }>()
const localOpen = ref(props.startOpen)

watch(() => props.startOpen, (value) => {
  if (props.open === undefined) localOpen.value = value
})

const isOpen = computed(() => props.open === undefined ? localOpen.value : props.open)

function toggle() {
  if (props.open === undefined) localOpen.value = !localOpen.value
  emit('toggle')
}
</script>

<template>
  <section class="section-card" :class="{ open: isOpen }">
    <button type="button" class="section-heading" :aria-expanded="isOpen" @click="toggle">
      <span>{{ title }}</span>
      <span class="section-heading-right">
        <span v-if="count !== undefined" class="section-count">{{ count }}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
      </span>
    </button>
    <div v-show="isOpen" class="section-content"><slot /></div>
  </section>
</template>
