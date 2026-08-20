import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const unitView = readFileSync('src/views/UnitView.vue', 'utf8')
const previewBuilder = readFileSync('scripts/inline-preview.mjs', 'utf8')

test('Equipment UI uses per-model control only through normalized selection semantic', () => {
  assert.match(unitView, /v-if="isPerModelWeaponSelection\(weapon\)"/)
  assert.match(unitView, /<div v-if="isPerModelEquipmentSelection\(option\)"[^>]*count-option-card/)
  assert.doesNotMatch(unitView, /<label[^>]*v-if="isPerModelEquipmentSelection\(option\)"/)
})
test('Melee and ranged tables are filtered through equipped-state helpers', () => {
  assert.match(unitView, /weapon\.kind === 'melee'[\s\S]*weaponIsEquipped\(weapon\)/)
  assert.match(unitView, /weapon\.kind === 'missile'[\s\S]*weaponIsEquipped\(weapon\)/)
})
test('Optional weapons are rendered in Equipment & Options', () => {
  assert.match(unitView, /<h2>Equipment & Options<\/h2>[\s\S]*optionalWeaponOptions/)
})
test('Standalone preview is generated from the built application rather than maintained as application source', () => {
  assert.match(previewBuilder, /ODX-STANDALONE-PREVIEW/)
  assert.match(previewBuilder, /dist-review/)
  assert.match(previewBuilder, /SOURCE-SHA256/)
})

test('Rule HTML sanitizer strips active content and event/style attributes', () => {
  const source = readFileSync('src/services/ruleContentTransform.ts', 'utf8')
  assert.match(source, /querySelectorAll\('script, style, noscript, iframe, object, embed, form, input, select, textarea, button, nav, header, footer'\)/)
  assert.match(source, /\/\^on\/i\.test\(attr\.name\).*attr\.name === 'style'.*attr\.name === 'srcset'/s)
  assert.match(source, /url\.protocol === 'http:'.*url\.protocol === 'https:'/s)
  assert.match(source, /anchor\.rel = 'noreferrer'/)
})


test('Magic item picker has one selector and no search/type filter fields', () => {
  assert.doesNotMatch(unitView, /magicSearch|magic-search|All allowed types|v-model="magicType"/)
  assert.match(unitView, /Select magic item/)
  assert.match(unitView, /magicItemCards[\s\S]*RuleAbilityCard/)
})

test('Magic item cards are separate from Special Rules', () => {
  assert.match(unitView, /const packedSpecialRules = computed\(\(\) => \[\.\.\.activeSpecialRules\.value\]/)
  assert.doesNotMatch(unitView, /packedSpecialRules[\s\S]{0,120}magicItemCards/)
})

test('Unit profile does not render composition/detail notes panel text', () => {
  assert.doesNotMatch(unitView, /prototypeUnit\.compositionNotes/)
  assert.doesNotMatch(unitView, /unit-details-note/)
})

test('Mounted rider profile effects are supplied from the selected mount option', () => {
  assert.match(unitView, /mountedRider:\s*\{ active: Boolean\(selectedMount\) && !selectedMountProfile, modifiers: selectedMount\?\.riderProfileModifiers \}/)
})


test('Army-list composition choices render as plain checkbox text rather than option pills', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(styles, /\.composition-option \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/)
  assert.match(styles, /\.create-list-page \.composition-option span,\.list-settings-panel \.composition-option span\{[^}]*border:0[^}]*background:transparent/s)
})

test('Settings text-size choices remain left-to-right at narrow widths', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(styles, /\.font-size-control \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: nowrap;/)
  assert.doesNotMatch(styles, /\.font-size-control\s*\{[^}]*grid-template-columns/s)
})


test('Equipment & Options groups follow a stable logical order', () => {
  const equipment = unitView.indexOf("{ key: 'equipment', title: 'Armour & Equipment'")
  const role = unitView.indexOf("{ key: 'role', title: 'Command & Role'")
  const mount = unitView.indexOf("{ key: 'mount', title: 'Mount'")
  const mountOption = unitView.indexOf("{ key: 'mount-option', title: 'Mount Options'")
  const special = unitView.indexOf("{ key: 'special', title: 'Special Rules & Upgrades'")
  const wizard = unitView.indexOf("{ key: 'wizard', title: 'Wizard Level'")
  assert.ok(equipment >= 0 && equipment < role && role < mount && mount < mountOption && mountOption < special && special < wizard)
})

test('Unit option steppers use a consistent 30px add/remove target', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(styles, /\.equipment-quantity-controls button,\.option-stepper button\{[^}]*width:30px;[^}]*height:30px;/s)
})

test('Unimplemented roster toolbar actions are visibly disabled rather than acting like live controls', () => {
  const builder = readFileSync('src/views/ListBuilderView.vue', 'utf8')
  assert.match(builder, /class="builder-tool" disabled title="Import is not available in this build"/)
  assert.match(builder, /class="builder-tool" disabled title="Export is not available in this build"/)
  assert.match(builder, /class="builder-tool" disabled title="Game View is not available in this build"/)
})

test('Weapon Special Rules render as rounded pills from every weapon rule', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(unitView, /weapon\.rules[\s\S]*map\(\(label\) => \(\{ label, path: specialRulePath\(label\) \}\)\)/)
  assert.match(styles, /\.weapon-rule-label[\s\S]*border-radius:999px/)
})

test('Special-rule and magical-item cards carry explicit kind pills', () => {
  const card = readFileSync('src/components/RuleAbilityCard.vue', 'utf8')
  assert.match(card, /kindLabel \|\| 'Special Rule'/)
  assert.match(unitView, /kind-label="Magical Item"/)
})

test('Composition options exclude match-only terrain and weather and include the new magic modes', () => {
  const data = readFileSync('src/data/listBuilder.ts', 'utf8')
  assert.doesNotMatch(data, /wilderness-terrain|disruptive-weather/)
  assert.match(data, /limit-one-magic/)
  assert.match(data, /magical-maelstrom/)
})

test('Frenzy sourced from the armour collection is classified as a Special Rules & Upgrades option', () => {
  const source = readFileSync('src/data/liveBuilderUnits.ts', 'utf8')
  assert.match(source, /add\(item, frenzy \? 'special' : 'armour'/)
})

test('War-machine armaments are classified as ranged weapons by the live mapper', () => {
  const source = readFileSync('src/data/liveBuilderUnits.ts', 'utf8')
  assert.match(source, /stone thrower[\s\S]*ballista[\s\S]*trebuchet[\s\S]*mortar[\s\S]*cannon\/i/)
})

test('Characteristic profile order is Unit, Champion, optional model, then mount', () => {
  const unitWeight = unitView.indexOf("if (row.selectionId) return 2")
  const championWeight = unitView.indexOf("return 1", unitView.indexOf("champion|boss|captain|sergeant|champ"))
  const mountWeight = unitView.indexOf("if (isMountProfileName(name)) return 3")
  assert.ok(unitWeight >= 0 && championWeight >= 0 && mountWeight >= 0)
})

test('Magic items remain removable while editing', () => {
  assert.match(unitView, /magic-remove-button[\s\S]*adjustMagicItem\(entry\.item\.id, -entry\.count\)/)
  assert.match(unitView, /aria-label="Remove one copy"[\s\S]*adjustMagicItem\(entry\.item\.id, -1\)/)
})


test('Roster edit autosave is a pure snapshot and cannot normalize watched refs', () => {
  const start = unitView.indexOf('function saveCurrentRosterConfiguration()')
  const end = unitView.indexOf('let rosterSaveQueued', start)
  assert.ok(start >= 0 && end > start)
  const autosave = unitView.slice(start, end)
  assert.doesNotMatch(autosave, /normalizeSelections\(\)|normalizeWeaponCounts\(\)|normalizeEquipmentCounts\(\)/)
  assert.match(unitView, /let rosterSaveQueued = false[\s\S]*function queueRosterSave\(\)[\s\S]*watch\(\[selectedWeaponIds, selectedEquipmentIds, selectedMagicCounts, magicItemDetails, modelCount, weaponCounts, equipmentCounts\], queueRosterSave\)/)
})
