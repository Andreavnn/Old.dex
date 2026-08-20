#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_all_checked(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{label}: expected {expected} matches, found {count}')
    return text.replace(old, new)


# Settings state: four faction themes + dark mode compatibility.
path = 'src/settings.ts'
s = read(path)
s = replace_once(s,
    "export type FontSize = 'smallest' | 'small' | 'normal' | 'large' | 'largest'\n",
    "export type FontSize = 'smallest' | 'small' | 'normal' | 'large' | 'largest'\nexport type VisualTheme = 'default' | 'forces-of-fantasy' | 'powers-of-chaos' | 'legions-of-undead' | 'ravening-hordes'\n",
    'settings visual-theme type')
s = replace_once(s, "  boldText: boolean\n}", "  boldText: boolean\n  visualTheme: VisualTheme\n}", 'settings state visualTheme')
s = replace_once(s, "const storageKey = 'olddex.settings.v0.10'", "const storageKey = 'olddex.settings.v0.11'", 'settings storage version')
s = replace_once(s, "  boldText: false,\n}", "  boldText: false,\n  visualTheme: 'default',\n}", 'settings defaults visualTheme')
s = replace_once(s,
    "function loadSettings(): SettingsState {",
    "function normalizeVisualTheme(value: unknown): VisualTheme {\n  const allowed: VisualTheme[] = ['default', 'forces-of-fantasy', 'powers-of-chaos', 'legions-of-undead', 'ravening-hordes']\n  return allowed.includes(String(value) as VisualTheme) ? value as VisualTheme : 'default'\n}\n\nfunction loadSettings(): SettingsState {",
    'settings theme normalizer')
s = replace_once(s,
    "    const legacy = JSON.parse(readStorage('olddex.settings.v0.9') || readStorage('olddex.settings.v0.8') || readStorage('olddex.settings.v0.7') || readStorage('olddex.settings.v0.6') || readStorage('olddex.settings.v0.4') || '{}')",
    "    const legacy = JSON.parse(readStorage('olddex.settings.v0.10') || readStorage('olddex.settings.v0.9') || readStorage('olddex.settings.v0.8') || readStorage('olddex.settings.v0.7') || readStorage('olddex.settings.v0.6') || readStorage('olddex.settings.v0.4') || '{}')",
    'settings legacy chain')
s = replace_once(s, "      boldText: Boolean(saved.boldText),\n    }", "      boldText: Boolean(saved.boldText),\n      visualTheme: normalizeVisualTheme(saved.visualTheme),\n    }", 'settings load visual theme')
s = replace_once(s,
    "  document.documentElement.dataset.boldText = state.boldText ? 'true' : 'false'\n}",
    "  document.documentElement.dataset.boldText = state.boldText ? 'true' : 'false'\n  document.documentElement.dataset.factionTheme = state.visualTheme\n}",
    'settings apply visual theme')
s = replace_once(s,
    "    boldText: toRef(state, 'boldText'),\n    toggleTheme:",
    "    boldText: toRef(state, 'boldText'),\n    visualTheme: toRef(state, 'visualTheme'),\n    toggleTheme:",
    'settings expose visualTheme')
write(path, s)


# Settings page: live theme controls + reset local user data.
path = 'src/views/SettingsView.vue'
s = read(path)
s = replace_once(s, "import { ref } from 'vue'", "import { computed, ref } from 'vue'", 'settings view computed import')
s = replace_once(s, "import { useSettings, type FontSize } from '../settings'", "import { useSettings, type FontSize, type VisualTheme } from '../settings'", 'settings view visual theme type')
s = replace_once(s, "import { writeStorage } from '../services/storage'", "import { removeStorage, storageKeys, writeStorage } from '../services/storage'", 'settings view storage helpers')
s = replace_once(s,
    "const { darkMode, compactRows, fontSize, boldText, reset } = useSettings()",
    "const { darkMode, compactRows, fontSize, boldText, visualTheme, reset } = useSettings()",
    'settings view visualTheme binding')
s = replace_once(s,
    "const updateMessage = ref('')\n",
    "const updateMessage = ref('')\nconst dataResetState = ref<'idle' | 'running'>('idle')\n\nconst themeOptions: Array<{ value: Exclude<VisualTheme, 'default'>; label: string; note: string }> = [\n  { value: 'forces-of-fantasy', label: 'Forces of Fantasy', note: 'Cool blue and heraldic parchment accents.' },\n  { value: 'powers-of-chaos', label: 'Powers of Chaos', note: 'Crimson, brass and dark iron accents.' },\n  { value: 'legions-of-undead', label: 'Legions of Undead', note: 'Cold bone, grave-green and ancient metal accents.' },\n  { value: 'ravening-hordes', label: 'Ravening Hordes', note: 'Muted green, ochre and field-parchment accents.' },\n]\nconst currentThemeLabel = computed(() => themeOptions.find((option) => option.value === visualTheme.value)?.label || 'Default')\n\nfunction toggleVisualTheme(value: Exclude<VisualTheme, 'default'>, event: Event) {\n  const checked = Boolean((event.target as HTMLInputElement | null)?.checked)\n  visualTheme.value = checked ? value : (visualTheme.value === value ? 'default' : visualTheme.value)\n}\n\nfunction resetLocalData() {\n  if (typeof window === 'undefined' || dataResetState.value === 'running') return\n  const confirmed = window.confirm('Reset Old.dex local data? This removes saved army lists, favorites, cached rule/army content, and other locally added app data. Display settings and themes are preserved.')\n  if (!confirmed) return\n  dataResetState.value = 'running'\n  storageKeys()\n    .filter((key) => key.startsWith('olddex.') && !key.startsWith('olddex.settings.'))\n    .forEach((key) => removeStorage(key))\n  window.setTimeout(() => window.location.reload(), 120)\n}\n",
    'settings view theme/reset state')
old_theme = '''        <div class="setting-row static-row support-placeholder-row">
          <span><strong>Themes</strong><small>Additional Old.dex visual themes will be added here in a later build.</small></span>
          <span class="value-chip">COMING SOON</span>
        </div>'''
new_theme = '''        <details class="theme-settings-panel">
          <summary>
            <span><strong>Themes</strong><small>Faction themes change the Old.dex palette while preserving the selected light or dark mode.</small></span>
            <span class="value-chip">{{ currentThemeLabel }}</span>
          </summary>
          <div class="theme-option-list">
            <label v-for="theme in themeOptions" :key="theme.value" class="theme-option-row setting-row">
              <span><strong>{{ theme.label }}</strong><small>{{ theme.note }}</small></span>
              <input :checked="visualTheme === theme.value" type="checkbox" @change="toggleVisualTheme(theme.value, $event)" />
            </label>
          </div>
        </details>'''
s = replace_once(s, old_theme, new_theme, 'settings theme panel')
old_data_start = '''      <section class="settings-card">
        <div class="setting-row update-setting-row">'''
new_data_start = '''      <section class="settings-card">
        <div class="setting-row reset-data-row">
          <span><strong>Reset local data</strong><small>Remove saved army lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.</small></span>
          <button class="secondary-button settings-compact-action" type="button" :disabled="dataResetState === 'running'" @click="resetLocalData">{{ dataResetState === 'running' ? 'Resetting…' : 'Reset data' }}</button>
        </div>
        <div class="setting-row update-setting-row">'''
s = replace_once(s, old_data_start, new_data_start, 'settings reset data row')
write(path, s)


# Roster category percentage health colors.
path = 'src/views/ListBuilderView.vue'
s = read(path)
needle = '''function categoryPercent(category: DisplayCategory) {
  return points.value > 0 ? Math.round((categoryRulePoints(category) / points.value) * 100) : 0
}
'''
addition = needle + '''type CategoryPercentageState = 'neutral' | 'green' | 'yellow' | 'red'
function categoryPercentageState(category: DisplayCategory): CategoryPercentageState {
  const allowance = categoryAllowance(category)
  if (!allowance || allowance.percent <= 0) return 'neutral'
  const current = categoryPercent(category)
  const target = allowance.percent
  if (allowance.qualifier === 'Needed') {
    if (current >= target) return 'green'
    if (current >= Math.ceil(target * 0.75)) return 'yellow'
    return 'red'
  }
  if (current >= target) return 'red'
  if (current >= Math.ceil(target * 0.75)) return 'yellow'
  return 'green'
}
'''
s = replace_once(s, needle, addition, 'category percentage state helper')
s = replace_once(s,
    '<strong>{{ categoryPercent(category) }}% / {{ categoryAllowance(category)?.percent }}%</strong>',
    '<strong class="category-percentage-status" :class="`status-${categoryPercentageState(category)}`">{{ categoryPercent(category) }}% / {{ categoryAllowance(category)?.percent }}%</strong>',
    'category percentage state class')
write(path, s)


# Roster unit cards: point total rectangle above action row.
path = 'src/components/BuilderUnitEntry.vue'
s = read(path)
s = replace_once(s,
    '''      <div class="builder-unit-name-row">
        <RouterLink class="builder-unit-name" :to="viewPath">{{ row.name }}</RouterLink>
        <span class="builder-unit-points">{{ row.totalPoints }} pts</span>
      </div>''',
    '''      <div class="builder-unit-name-row">
        <RouterLink class="builder-unit-name" :to="viewPath">{{ row.name }}</RouterLink>
      </div>''',
    'roster remove inline points')
s = replace_once(s,
    '''    <div class="builder-unit-actions" aria-label="Unit controls">
      <RouterLink v-if="!locked" class="builder-mini-action primary" :to="editPath">Edit</RouterLink><span v-else class="builder-mini-action disabled" aria-disabled="true">Edit</span>
      <RouterLink class="builder-mini-action icon-only-action" :to="viewPath" aria-label="View unit" title="View"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg></RouterLink>
      <button type="button" class="builder-mini-action icon-only-action" :disabled="locked" aria-label="Copy unit" title="Copy" @click="emit('duplicate')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
      <button type="button" class="builder-mini-action danger" :disabled="locked" @click="emit('remove')">Remove</button>
    </div>''',
    '''    <div class="builder-unit-control-column">
      <span class="builder-unit-points-box">{{ row.totalPoints }} pts</span>
      <div class="builder-unit-actions" aria-label="Unit controls">
        <RouterLink v-if="!locked" class="builder-mini-action primary" :to="editPath">Edit</RouterLink><span v-else class="builder-mini-action disabled" aria-disabled="true">Edit</span>
        <RouterLink class="builder-mini-action icon-only-action" :to="viewPath" aria-label="View unit" title="View"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg></RouterLink>
        <button type="button" class="builder-mini-action icon-only-action" :disabled="locked" aria-label="Copy unit" title="Copy" @click="emit('duplicate')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
        <button type="button" class="builder-mini-action danger" :disabled="locked" @click="emit('remove')">Remove</button>
      </div>
    </div>''',
    'roster point/control column')
write(path, s)


# General context: visually mark the already-selected General as Current.
path = 'src/views/UnitView.vue'
s = read(path)
s = replace_once(s,
    '''function contextualOptionName(option: PrototypeEquipmentOption) {
  const label = displayOptionName(option)
  if (!/^General$/i.test(option.name.trim()) || selectedEquipmentIds.value.has(option.id) || !otherGeneralName.value) return label
  return `${label} - ${otherGeneralName.value}`
}
''',
    '''function contextualOptionName(option: PrototypeEquipmentOption) {
  const label = displayOptionName(option)
  if (!/^General$/i.test(option.name.trim()) || selectedEquipmentIds.value.has(option.id) || !otherGeneralName.value) return label
  return `${label} - ${otherGeneralName.value}`
}
function showOtherGeneralCurrent(option: PrototypeEquipmentOption) {
  return /^General$/i.test(option.name.trim()) && !selectedEquipmentIds.value.has(option.id) && Boolean(otherGeneralName.value)
}
''',
    'general current helper')
s = replace_all_checked(s,
    '<span class="option-name">{{ contextualOptionName(option) }}</span>',
    '<span class="option-name">{{ contextualOptionName(option) }}<small v-if="showOtherGeneralCurrent(option)" class="current-general-note"> (Current)</small></span>',
    2,
    'general current labels')
write(path, s)


# CSS: validation cleanup, pill parity, roster points, percentage traffic lights, themes.
path = 'src/styles.css'
s = read(path)
marker = '/* Old.dex v0.56 roster/theme source pass */'
if marker in s:
    raise RuntimeError('styles: v0.56 marker already present')
css = r'''

/* Old.dex v0.56 roster/theme source pass */
.builder-validation-list{border-top:0;margin-top:8px;padding-top:4px}
.old-world-weapon-table .weapon-rule-labels{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px}
.old-world-weapon-table .weapon-rule-label{display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:3px 8px;border:1px solid var(--line-dark);border-radius:999px;background:var(--paper);color:var(--ink);font-size:calc(8.5px + var(--font-offset));font-weight:650;letter-spacing:0;line-height:1.2;text-decoration:none;text-transform:none}
.old-world-weapon-table .weapon-rule-label:hover{border-color:var(--accent);background:var(--accent-wash)}
.builder-unit-control-column{display:grid;justify-items:center;align-content:center;gap:7px;min-width:216px}
.builder-unit-points-box{display:inline-flex;align-items:center;justify-content:center;min-width:88px;min-height:29px;padding:4px 11px;border:1px solid var(--line-dark);border-radius:7px;background:var(--paper);color:var(--accent-dark);font-size:calc(10px + var(--font-offset));font-weight:850;font-variant-numeric:tabular-nums}
.builder-unit-control-column .builder-unit-actions{justify-content:center}
.current-general-note{color:var(--ink-soft);font-size:.86em;font-weight:500;white-space:nowrap}
.category-percentage-status{transition:color .15s ease}
.category-percentage-status.status-green{color:#2f7d46}.category-percentage-status.status-yellow{color:#9a6a18}.category-percentage-status.status-red{color:#b3261e}
:root[data-theme="dark"] .category-percentage-status.status-green{color:#67c884}:root[data-theme="dark"] .category-percentage-status.status-yellow{color:#e0b85f}:root[data-theme="dark"] .category-percentage-status.status-red{color:#ee8278}
.theme-settings-panel{border-bottom:1px solid #e6e1d8;background:var(--paper)}
.theme-settings-panel>summary{list-style:none;min-height:69px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:15px;cursor:pointer}
.theme-settings-panel>summary::-webkit-details-marker{display:none}.theme-settings-panel>summary>span:first-child{display:grid;gap:3px}.theme-settings-panel>summary small{color:var(--ink-soft);font-weight:500;line-height:1.35}.theme-settings-panel>summary::after{content:'›';color:var(--ink-soft);font-size:1.25rem;transform:rotate(90deg);transition:transform .15s ease}.theme-settings-panel[open]>summary::after{transform:rotate(-90deg)}.theme-settings-panel>summary .value-chip{margin-left:auto}.theme-option-list{border-top:1px solid var(--line);background:var(--paper-2)}.theme-option-row{min-height:61px;padding-left:28px;background:transparent}.theme-option-row:last-child{border-bottom:0}
:root[data-faction-theme="forces-of-fantasy"]{--paper:#fbfcfd;--paper-2:#edf2f7;--line:#c8d2df;--line-dark:#9fb1c6;--accent:#4f6f98;--accent-dark:#2f4e76;--accent-wash:#dce7f3;--page-bg:#e9edf2;--page-gradient:linear-gradient(180deg,#f5f7fa 0,#e9edf2 420px)}
:root[data-theme="dark"][data-faction-theme="forces-of-fantasy"]{--ink:#edf3fa;--ink-soft:#a7b5c5;--paper:#1d2530;--paper-2:#24303d;--line:#334457;--line-dark:#516b86;--accent:#82a8d3;--accent-dark:#adc8e7;--accent-wash:#283c52;--page-bg:#141a22;--page-gradient:linear-gradient(180deg,#1c2530 0,#141a22 420px)}
:root[data-faction-theme="powers-of-chaos"]{--paper:#fcf9f7;--paper-2:#f3eae5;--line:#ddcbc2;--line-dark:#c19e8d;--accent:#9a4939;--accent-dark:#6d2e24;--accent-wash:#efdcd5;--danger:#8e2f2f;--page-bg:#eee9e6;--page-gradient:linear-gradient(180deg,#f8f3f0 0,#eee9e6 420px)}
:root[data-theme="dark"][data-faction-theme="powers-of-chaos"]{--ink:#f3e9e5;--ink-soft:#bca39a;--paper:#261c19;--paper-2:#30231f;--line:#4b3730;--line-dark:#704c40;--accent:#d67863;--accent-dark:#eda08f;--accent-wash:#492a24;--danger:#ec7a70;--page-bg:#1c1513;--page-gradient:linear-gradient(180deg,#261c19 0,#1c1513 420px)}
:root[data-faction-theme="legions-of-undead"]{--paper:#f8fbf9;--paper-2:#edf2ef;--line:#c7d2cc;--line-dark:#9dafaa;--accent:#5e766f;--accent-dark:#3e5750;--accent-wash:#dae6e1;--page-bg:#e8ecea;--page-gradient:linear-gradient(180deg,#f2f6f4 0,#e8ecea 420px)}
:root[data-theme="dark"][data-faction-theme="legions-of-undead"]{--ink:#e9f1ee;--ink-soft:#9fb3ad;--paper:#1c2522;--paper-2:#24302c;--line:#354942;--line-dark:#526d64;--accent:#88b2a6;--accent-dark:#b0d1c7;--accent-wash:#284039;--page-bg:#131a18;--page-gradient:linear-gradient(180deg,#1d2824 0,#131a18 420px)}
:root[data-faction-theme="ravening-hordes"]{--paper:#fbfbf5;--paper-2:#f1f0df;--line:#d6d4b8;--line-dark:#ada977;--accent:#737238;--accent-dark:#53531f;--accent-wash:#e5e4c4;--page-bg:#edede5;--page-gradient:linear-gradient(180deg,#f7f7ef 0,#edede5 420px)}
:root[data-theme="dark"][data-faction-theme="ravening-hordes"]{--ink:#f0f0e4;--ink-soft:#b2b19a;--paper:#222319;--paper-2:#2b2d20;--line:#444631;--line-dark:#666846;--accent:#b0b16e;--accent-dark:#d0d18f;--accent-wash:#3c3e25;--page-bg:#191a12;--page-gradient:linear-gradient(180deg,#242519 0,#191a12 420px)}
@media(max-width:620px){.builder-unit-control-column{min-width:0;width:100%;margin-top:11px}.builder-unit-control-column .builder-unit-actions{margin-top:0}.theme-settings-panel>summary{align-items:flex-start}.theme-settings-panel>summary .value-chip{display:none}.theme-option-row{padding-left:18px}}
'''
s = s.rstrip() + css + '\n'
write(path, s)


# Version and canonical changelogs.
path = 'package.json'
s = replace_once(read(path), '"version": "0.55.0"', '"version": "0.56.0"', 'package version')
write(path, s)

path = 'README.md'
s = read(path)
s = replace_once(s, '# Old.dex GUI v0.55', '# Old.dex GUI v0.56', 'README version')
s = replace_once(s,
    'Alpha Build 0.55 refines roster/profile presentation: integer category percentages, point-only list totals, two-column magical-item rows, contextual General selection, publication fallbacks, integrated unit-size controls, centered weapon tables, conditional AP presentation, and clearer validation spacing.',
    'Alpha Build 0.56 refines roster validation and unit-card presentation, adds requirement-aware category status colors, identifies the current General, adds a safe local-data reset, and introduces four faction themes that remain compatible with light and dark mode.',
    'README current build')
write(path, s)

changelog_heading = '''## Alpha Build 0.56 — Roster status, current General, local-data reset, and faction themes

- Removed the stray divider above Army Validation issues and normalized Melee/Range special-rule pills to the same centered, regular-weight pill treatment used elsewhere.
- Added requirement-aware red/yellow/green status coloring to category percentages: minimum requirements progress from red to yellow to green, while maximum allowances progress from green to yellow to red as the limit is approached.
- Moved each roster unit/model point total into a centered rectangular badge above Edit/View/Copy/Remove controls and added a light `(Current)` marker after the roster model already assigned as General.
- Added a Reset local data action that clears saved lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.
- Replaced the Themes placeholder with collapsible Forces of Fantasy, Powers of Chaos, Legions of Undead, and Ravening Hordes theme switches, with dedicated light and dark palettes so Dark mode remains fully compatible.

'''
path = 'CHANGELOG.md'
s = read(path)
anchor = 'This is the canonical duplicate-free project history. The in-app Changelog mirrors these same entries. Repeated correction passes are consolidated into the build or build range where the behavior became part of the application source.\n\n'
s = replace_once(s, anchor, anchor + changelog_heading, 'GitHub changelog 0.56')
write(path, s)

path = 'src/data/changelog.ts'
s = read(path)
entry = '''  { version: '0.56', title: 'Roster status, current General, local-data reset, and faction themes', notes: [
    'Removed the stray divider above Army Validation issues and normalized Melee/Range special-rule pills to the same centered, regular-weight pill treatment used elsewhere.',
    'Added requirement-aware red/yellow/green status coloring to category percentages: minimum requirements progress from red to yellow to green, while maximum allowances progress from green to yellow to red as the limit is approached.',
    'Moved each roster unit/model point total into a centered rectangular badge above Edit/View/Copy/Remove controls and added a light (Current) marker after the roster model already assigned as General.',
    'Added a Reset local data action that clears saved lists, favorites, cached content, and other locally added Old.dex data while preserving Display settings.',
    'Replaced the Themes placeholder with collapsible Forces of Fantasy, Powers of Chaos, Legions of Undead, and Ravening Hordes theme switches, with dedicated light and dark palettes so Dark mode remains fully compatible.',
  ] },
'''
s = replace_once(s, 'export const changelogEntries: ChangelogEntry[] = [\n', 'export const changelogEntries: ChangelogEntry[] = [\n' + entry, 'in-app changelog 0.56')
write(path, s)

# Static regression contract for this pass.
test_path = ROOT / 'tests/v056-regression.test.mjs'
test_path.write_text(r'''import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('v0.56 roster percentage status is requirement-aware', () => {
  const source = read('src/views/ListBuilderView.vue')
  assert.match(source, /function categoryPercentageState/)
  assert.match(source, /allowance\.qualifier === 'Needed'/)
  assert.match(source, /status-\$\{categoryPercentageState\(category\)\}/)
})

test('v0.56 identifies the current General and moves unit points above controls', () => {
  const unit = read('src/views/UnitView.vue')
  const roster = read('src/components/BuilderUnitEntry.vue')
  assert.match(unit, /current-general-note/)
  assert.match(unit, /\(Current\)/)
  assert.match(roster, /builder-unit-points-box/)
  assert.match(roster, /builder-unit-control-column/)
})

test('v0.56 exposes reset data and four faction themes', () => {
  const settings = read('src/views/SettingsView.vue')
  const state = read('src/settings.ts')
  const css = read('src/styles.css')
  for (const theme of ['forces-of-fantasy', 'powers-of-chaos', 'legions-of-undead', 'ravening-hordes']) {
    assert.match(settings, new RegExp(theme))
    assert.match(state, new RegExp(theme))
    assert.match(css, new RegExp(`data-faction-theme="${theme}"`))
  }
  assert.match(settings, /Reset local data/)
  assert.match(settings, /!key\.startsWith\('olddex\.settings\.'/)
  assert.match(css, /data-theme="dark"\]\[data-faction-theme=/)
})

test('v0.56 validation and weapon-rule pill styles are normalized', () => {
  const css = read('src/styles.css')
  assert.match(css, /\.builder-validation-list\{border-top:0/)
  assert.match(css, /\.old-world-weapon-table \.weapon-rule-label\{[\s\S]*?font-weight:650/)
})
''', encoding='utf-8')

print('Old.dex v0.56 source changes applied successfully.')
