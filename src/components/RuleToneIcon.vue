<script setup lang="ts">
import { computed } from 'vue'
import type { RuleTone } from '../data/builderPrototype'
import movementIcon from '../assets/characteristics/m.png'
import weaponSkillIcon from '../assets/characteristics/ws.png'
import ballisticSkillIcon from '../assets/characteristics/bs.png'
import leadershipIcon from '../assets/characteristics/ld.png'
import specialRuleIcon from '../assets/characteristics/usr.png'
import spellIcon from '../assets/characteristics/magic.png'

const props = defineProps<{ tone: RuleTone }>()

// Prefer a specific approved icon when the rule tone has a clear match.
// The Special Rule mark is intentionally the fallback for tones without one.
const icons: Record<RuleTone, string> = {
  strategy: leadershipIcon,
  movement: movementIcon,
  shooting: ballisticSkillIcon,
  combat: weaponSkillIcon,
  magic: spellIcon,
  passive: specialRuleIcon,
  reaction: specialRuleIcon,
}

const icon = computed(() => icons[props.tone] || specialRuleIcon)
</script>

<template>
  <span class="rule-tone-icon" aria-hidden="true"><img :src="icon" alt="" /></span>
</template>
