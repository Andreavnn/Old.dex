<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label class="search-bar">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input
      :value="modelValue"
      :placeholder="placeholder || 'Filter'"
      type="search"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button v-if="modelValue" type="button" class="search-clear" aria-label="Clear search" @click="emit('update:modelValue', '')">×</button>
  </label>
</template>
