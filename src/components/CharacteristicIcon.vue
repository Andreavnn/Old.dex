<script setup lang="ts">
import { computed } from 'vue'
import type { ProfileKey } from '../data/builderPrototype'
import mIcon from '../assets/characteristics/m.png'
import aIcon from '../assets/characteristics/a.png'
import wsIcon from '../assets/characteristics/ws.png'
import bsIcon from '../assets/characteristics/bs.png'
import sIcon from '../assets/characteristics/s.png'
import tIcon from '../assets/characteristics/t.png'
import wIcon from '../assets/characteristics/w.png'
import iIcon from '../assets/characteristics/i.png'
import ldIcon from '../assets/characteristics/ld.png'
import svIcon from '../assets/characteristics/sv.png'
import wdIcon from '../assets/characteristics/wd.png'
import rnIcon from '../assets/characteristics/rn.png'

const props = defineProps<{ stat: ProfileKey }>()
const icons: Partial<Record<ProfileKey, string>> = { M: mIcon, A: aIcon, WS: wsIcon, BS: bsIcon, S: sIcon, T: tIcon, W: wIcon, I: iIcon, Ld: ldIcon, Sv: svIcon, Ward: wdIcon, Rn: rnIcon }
const icon = computed(() => icons[props.stat] || '')
</script>

<template>
  <span v-if="icon" class="characteristic-icon" aria-hidden="true"><img :src="icon" alt="" /></span>
</template>
