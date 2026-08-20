<script setup lang="ts">
import { computed } from 'vue'
import type { RuleTone } from '../data/builderPrototype'
import movementIcon from '../assets/characteristics/m.png'
import weaponSkillIcon from '../assets/characteristics/ws.png'
import ballisticSkillIcon from '../assets/characteristics/bs.png'
import leadershipIcon from '../assets/characteristics/ld.png'
import specialRuleIcon from '../assets/characteristics/usr.png'
import magicIcon from '../assets/characteristics/magic.png'
import vortexIcon from '../assets/characteristics/spell-vortex.png'
import enchantmentIcon from '../assets/characteristics/spell-enchantment.png'
import hexIcon from '../assets/characteristics/spell-hex.png'
import conveyanceIcon from '../assets/characteristics/spell-conveyance.png'
import magicMissileIcon from '../assets/characteristics/spell-missile.png'
import assailmentIcon from '../assets/characteristics/spell-assailment.png'

const props = defineProps<{ tone: RuleTone; label?: string }>()

const toneIcons: Record<RuleTone, string> = {
  strategy: leadershipIcon,
  movement: movementIcon,
  shooting: ballisticSkillIcon,
  combat: weaponSkillIcon,
  magic: magicIcon,
  passive: specialRuleIcon,
  reaction: specialRuleIcon,
}

function spellTypeIcon(value: string) {
  const label = value.toLowerCase()
  if (/magical\s+vortex|\bvortex\b/.test(label)) return vortexIcon
  if (/\benchantment\b/.test(label)) return enchantmentIcon
  if (/\bhex\b/.test(label)) return hexIcon
  if (/\bconveyance\b/.test(label)) return conveyanceIcon
  if (/magic\s+missile/.test(label)) return magicMissileIcon
  if (/\bassailment\b/.test(label)) return assailmentIcon
  return ''
}

const icon = computed(() => {
  if (props.tone === 'magic') return spellTypeIcon(props.label || '') || magicIcon
  return toneIcons[props.tone] || specialRuleIcon
})
</script>

<template>
  <span class="rule-tone-icon" aria-hidden="true"><img :src="icon" alt="" /></span>
</template>
