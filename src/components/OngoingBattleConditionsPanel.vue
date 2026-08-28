<script setup lang="ts">
type OngoingBattleConditionRow = {
  id: string
  label: string
  path: string
  result: {
    roll?: string
    title: string
    text: string
  }
}

defineProps<{ rows: OngoingBattleConditionRow[] }>()
</script>

<template>
  <section class="ongoing-battle-conditions card-inset" aria-label="Ongoing Battle Conditions">
    <div class="ongoing-battle-conditions-heading">
      <p class="eyebrow">ONGOING BATTLE CONDITIONS</p>
      <small>Active conditions that can continue to affect this battle.</small>
    </div>
    <div class="ongoing-battle-condition-list">
      <details v-for="condition in rows" :key="condition.id" class="phase-rule-details ongoing-condition-row">
        <summary><strong>{{ condition.label }}</strong><span>{{ condition.result.title }}</span></summary>
        <p>{{ condition.result.text }}</p>
        <RouterLink :to="`/rules/read${condition.path}`">Open rules</RouterLink>
      </details>
    </div>
  </section>
</template>
