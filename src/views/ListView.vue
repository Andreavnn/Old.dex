<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { getArmy } from '../data/armies'
import { loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { PrototypeUnit } from '../data/builderPrototype'
import { createSavedArmyList, exportSavedArmyList, getSavedArmyList, savedArmyListRoute, type SavedArmyList } from '../services/savedLists'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { useLanguagePreference } from '../services/language'
import { clearPendingRosterShareCode, decodeRosterShareValue, pendingRosterShareCode, stageRosterShareCode, type SharedRosterData } from '../services/rosterShare'

const route = useRoute()
const router = useRouter()
const { language } = useLanguagePreference()
const sharedMode = computed(() => route.name === 'list-shared')
const list = ref<SavedArmyList | null>(sharedMode.value ? null : getSavedArmyList(String(route.params.listId || '')))
const sharedError = ref('')
const sharedLoading = ref(sharedMode.value)
const shareCodeEntry = ref('')
const profiles = ref(new Map<string, PrototypeUnit>())
const army = computed(() => list.value ? getArmy(list.value.army) : null)
const actualPoints = computed(() => list.value?.actualPoints ?? (list.value?.roster || []).reduce((sum, row) => sum + row.totalPoints, 0))
const remaining = computed(() => (list.value?.points || 0) - actualPoints.value)
const categories = ['Characters', 'Core', 'Special', 'Rare', 'Mercenaries', 'Allies', 'Custom Units'] as const
function categoryRows(category: string) { return (list.value?.roster || []).filter((row) => row.category === category || (category === 'Characters' && row.category === 'General')) }
function cleanKey(value: string) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function handWeaponLabel(value: string) { const text = String(value || '').trim(); const match = text.match(/^Hand weapons?\s*(?:[×x]\s*)?\(?\s*(\d+)\s*\)?$/i); return match ? `${Number(match[1])} – (Hand Weapon)` : text }
function selectedLabels(row: BuilderRosterSelection) { const values = [...(row.includedEquipment || []), ...(row.optionalSelections || []), ...(row.options || [])].map(handWeaponLabel); const seen = new Set<string>(); return values.filter((value) => { const key = cleanKey(value); if (!key || seen.has(key)) return false; seen.add(key); return true }) }
function profileRows(row: BuilderRosterSelection) { const unit = profiles.value.get(row.instanceId); return unit?.profiles?.length ? unit.profiles : unit ? [{ name: unit.name, profile: unit.profile }] : [] }
function exportList() { if (list.value) exportSavedArmyList(list.value) }

function transientList(data: SharedRosterData): SavedArmyList {
  const now = new Date().toISOString()
  return { id: 'shared-transient', ...data, createdAt: now, updatedAt: now }
}
function shortenSharedLocation() {
  if (typeof window === 'undefined') return
  const shortPath = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(window.history.state, '', shortPath)
}
async function loadSharedRoster() {
  if (!sharedMode.value) return
  sharedLoading.value = true; sharedError.value = ''; list.value = null
  let source = route.hash || pendingRosterShareCode()
  try {
    if (route.hash) {
      source = stageRosterShareCode(route.hash)
      shortenSharedLocation()
    }
    if (!source) return
    list.value = transientList(await decodeRosterShareValue(source))
    shareCodeEntry.value = ''
  } catch (error) { sharedError.value = error instanceof Error ? error.message : 'This shared roster could not be opened.' }
  finally { sharedLoading.value = false; await loadProfiles() }
}
async function reviewEnteredShareCode() {
  const value = shareCodeEntry.value.trim()
  if (!value) { sharedError.value = 'Paste an Old.dex Share Code first.'; return }
  try { stageRosterShareCode(value); await loadSharedRoster() }
  catch (error) { sharedError.value = error instanceof Error ? error.message : 'This Share Code could not be opened.' }
}
function addSharedRoster() {
  if (!list.value || !sharedMode.value) return
  const source = list.value
  const saved = createSavedArmyList({ name: source.name, army: source.army, armyName: source.armyName, composition: source.composition, compositionName: source.compositionName, rule: source.rule, points: source.points, options: source.options || [], description: source.description || '', roster: source.roster || [], locked: Boolean(source.locked), actualPoints: source.actualPoints, validationStatus: source.validationStatus, enemyRoster: Boolean(source.enemyRoster) })
  clearPendingRosterShareCode()
  void router.replace({ name: 'list-view', params: { listId: saved.id } })
}
async function loadProfiles() {
  if (!list.value || !army.value) return
  const next = new Map<string, PrototypeUnit>()
  await Promise.all((list.value.roster || []).map(async (row) => { try { const unit = await loadLiveUnitProfile(army.value!.dataKey, army.value!.name, row.unitId, list.value!.composition); if (unit) next.set(row.instanceId, unit) } catch { /* saved selections remain readable without a live profile */ } }))
  profiles.value = next
}
onMounted(() => { if (sharedMode.value) void loadSharedRoster(); else void loadProfiles() })
watch(language, () => { void loadProfiles() })
watch(() => route.hash, () => { if (sharedMode.value) void loadSharedRoster() })
</script>

<template>
  <main class="page list-view-page">
    <AppHeader compact back-to="/lists" prefer-back-to />
    <p v-if="sharedLoading" class="setup-inline-status">Opening shared army roster…</p>
    <template v-if="list">
      <header class="list-view-hero card-surface">
        <div><p class="eyebrow">{{ sharedMode ? 'SHARED ARMY ROSTER' : 'ARMY ROSTER' }}</p><h1>{{ list.name }}</h1><p>{{ list.armyName }} · {{ list.compositionName }}</p></div>
        <div class="list-view-summary"><strong>{{ actualPoints }} / {{ list.points }} pts</strong><small>{{ remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over` }}</small><span class="roster-status-chip" :class="`is-${list.validationStatus || 'warning'}`">{{ (list.validationStatus || 'warning').toUpperCase() }}</span></div>
        <div class="list-view-actions"><template v-if="sharedMode"><button type="button" class="primary-button" @click="addSharedRoster">Add to My Rosters</button></template><template v-else><RouterLink :to="savedArmyListRoute(list)" class="secondary-button">Edit</RouterLink><button type="button" class="secondary-button roster-export-icon-button" aria-label="Export roster" title="Export" @click="exportList"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M12 9v8"/><path d="m8.5 13.5 3.5 3.5 3.5-3.5"/></svg></button></template></div>
      </header>
      <section v-if="sharedMode" class="card-surface shared-roster-notice"><strong>Shared roster preview</strong><p>This link does not save anything to this device automatically. Review it first, then choose Add to My Rosters if you want a local copy.</p></section>
      <section class="game-view-reference card-surface" aria-label="Army roster overview">
        <template v-for="category in categories" :key="category"><section v-if="categoryRows(category).length" class="list-view-category"><header><h2>{{ category }}</h2><strong>{{ categoryRows(category).reduce((sum, row) => sum + row.totalPoints, 0) }} pts</strong></header>
          <article v-for="row in categoryRows(category)" :key="row.instanceId" class="list-view-unit"><div class="list-view-unit-title"><strong>{{ row.modelCount && row.modelCount > 1 ? `${row.modelCount} ` : '' }}{{ row.name }}</strong><span>{{ row.totalPoints }} pts</span></div><div v-if="selectedLabels(row).length" class="list-view-loadout"><span v-for="label in selectedLabels(row)" :key="label">{{ label }}</span></div><div v-if="row.magicItems?.length" class="list-view-rule-line"><b>Magical Items:</b><span v-for="item in row.magicItems" :key="item.id">{{ item.name }}{{ item.count > 1 ? ` ×${item.count}` : '' }}</span></div><div v-if="row.specialRules?.length" class="list-view-rule-line"><b>Special Rules:</b><RouterLink v-for="rule in row.specialRules" :key="`${rule.label}-${rule.path}`" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink></div><div v-for="profileRow in profileRows(row)" :key="profileRow.name" class="list-view-profile-wrap"><table class="list-view-profile-table"><thead><tr><th>Model</th><th>M</th><th>WS</th><th>BS</th><th>S</th><th>T</th><th>W</th><th>I</th><th>A</th><th>Ld</th></tr></thead><tbody><tr><th>{{ profileRow.name }}</th><td>{{ profileRow.profile.M || '—' }}</td><td>{{ profileRow.profile.WS || '—' }}</td><td>{{ profileRow.profile.BS || '—' }}</td><td>{{ profileRow.profile.S || '—' }}</td><td>{{ profileRow.profile.T || '—' }}</td><td>{{ profileRow.profile.W || '—' }}</td><td>{{ profileRow.profile.I || '—' }}</td><td>{{ profileRow.profile.A || '—' }}</td><td>{{ profileRow.profile.Ld || '—' }}</td></tr></tbody></table></div></article>
        </section></template>
      </section>
    </template>
    <section v-else-if="sharedMode && !sharedLoading" class="empty-state card-surface share-code-receiver"><div class="empty-icon">↗</div><h2>{{ sharedError ? 'Shared roster unavailable' : 'Enter Share Code' }}</h2><p>{{ sharedError || 'Paste the Old.dex Share Code you received. This page stays at the short /lists/shared address while the roster is reviewed.' }}</p><textarea v-model="shareCodeEntry" class="share-code-receiver-input" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="ODX1:…"></textarea><div class="share-code-receiver-actions"><button type="button" class="primary-button" :disabled="!shareCodeEntry.trim()" @click="reviewEnteredShareCode">Review Shared Roster</button><RouterLink to="/lists" class="secondary-button">Back to Army Rosters</RouterLink></div></section>
    <section v-else-if="!sharedMode" class="empty-state card-surface"><div class="empty-icon">!</div><h2>Roster not found</h2><p>This saved army roster is no longer available on this device.</p><RouterLink to="/lists" class="primary-button">Back to Army Rosters</RouterLink></section>
  </main>
</template>

<style scoped>
.shared-roster-notice{margin-bottom:14px;padding:14px 16px}.shared-roster-notice p{margin:5px 0 0;color:var(--ink-soft)}
.roster-export-icon-button{width:44px;height:44px;min-height:44px;padding:0}.roster-export-icon-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.share-code-receiver{display:grid;gap:12px}.share-code-receiver-input{width:min(560px,100%);min-height:118px;margin:0 auto;resize:vertical;border:1px solid var(--line-dark);border-radius:10px;padding:10px;background:var(--paper-2);color:var(--ink);font:inherit;font-size:calc(9px + var(--font-offset));overflow-wrap:anywhere}.share-code-receiver-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
</style>
