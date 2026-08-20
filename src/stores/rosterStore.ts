import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { loadBuilderRoster, saveBuilderRoster } from '../services/builderRoster'

/**
 * Canonical active-roster owner for the list builder. Persistence is delegated to
 * builderRoster, which in turn uses exactly one backing store per roster: the
 * saved-list document for saved lists, or the transient roster key for unsaved lists.
 */
export function useRosterStore(builderPath: Ref<string>) {
  const rows = ref<BuilderRosterSelection[]>([])
  let hydrating = false

  function hydrate() {
    hydrating = true
    rows.value = loadBuilderRoster(builderPath.value)
    hydrating = false
  }

  function persist() {
    if (hydrating) return
    saveBuilderRoster(builderPath.value, rows.value)
  }

  function persistOnHide() {
    if (document.visibilityState === 'hidden') persist()
  }

  watch(builderPath, hydrate, { immediate: true })
  watch(rows, persist, { deep: true, flush: 'sync' })

  onMounted(() => {
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persistOnHide)
  })

  onBeforeUnmount(() => {
    persist()
    window.removeEventListener('pagehide', persist)
    document.removeEventListener('visibilitychange', persistOnHide)
  })

  return { rows, hydrate, persist }
}
