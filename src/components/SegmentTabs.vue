<script setup lang="ts">
defineProps<{ tabs: string[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="segment-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab"
      class="segment-tab"
      :class="{ active: modelValue === tab }"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab"
      @click="emit('update:modelValue', tab)"
    >
      {{ tab }}
    </button>
  </div>
</template>
