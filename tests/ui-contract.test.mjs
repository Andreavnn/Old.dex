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
  assert.match(styles, /\.font-size-control \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/)
  assert.match(styles, /\.font-size-control button \{[\s\S]*?min-width: 0;/)
  assert.doesNotMatch(styles, /\.font-size-control\s*\{[^}]*overflow-x:\s*auto/s)
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
  assert.match(unitView, /weapon\.hasUniqueRule && weapon\.path\) rows\.push\(\{ label: weapon\.name/)
  assert.doesNotMatch(unitView, /label:\s*'Weapon Rule'/)
  assert.match(styles, /\.weapon-rule-label[\s\S]*border-radius:999px/)
})

test('Special-rule and magical-item cards carry explicit kind pills', () => {
  const card = readFileSync('src/components/RuleAbilityCard.vue', 'utf8')
  assert.match(card, /props\.kindLabel \|\| 'Special Rule'/)
  assert.match(unitView, /kind-label="Magical Item"/)
  assert.match(card, /old-rule-keywords[\s\S]*rule-kind-pill/)
  const summary = card.match(/<div class="old-rule-summary[\s\S]*?<\/div>/)?.[0] || ''
  assert.doesNotMatch(summary, /rule-kind-pill/)
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

test('Dynamic profile characteristic changes preserve the user scroll position', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(unitView, /function restoreScrollPosition\([\s\S]*requestAnimationFrame[\s\S]*requestAnimationFrame/)
  assert.match(styles, /\.unit-page\{overflow-anchor:none\}/)
  assert.match(styles, /\.old-world-profile\{[^}]*overflow-anchor:none/s)
})

test('Magic-item cards use the same responsive two-column flow as Special Rules with actions attached beneath', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(styles, /\.magic-item-card-grid\{[^}]*column-count:2[^}]*column-gap:10px/s)
  assert.match(styles, /\.magic-item-card-grid>\.selected-magic-rule-card\{[^}]*display:inline-block[^}]*break-inside:avoid/s)
  assert.match(styles, /@media\(max-width:800px\)\{\.magic-item-card-grid\{column-count:1\}\}/)
  assert.match(styles, /\.magic-item-card-actions\{[^}]*width:100%/s)
})

test('Unit Details shows the starting unit size rather than the edited model count', () => {
  assert.match(unitView, /function startingUnitSize\(\)/)
  assert.match(unitView, /<small>Unit size<\/small><strong>\{\{ startingUnitSize\(\) \}\}<\/strong>/)
})

test('Unit picker point values use the same default-roster calculator as units added to the roster', () => {
  const builder = readFileSync('src/views/ListBuilderView.vue', 'utf8')
  assert.match(builder, /function startingUnitPoints\(unit: PrototypeUnit\)[\s\S]*createDefaultRosterSelection/)
  assert.match(builder, /unit-picker-points">\{\{ startingUnitPoints\(unit\) \}\} pts/)
})

test('The expanded icon pack includes all six spell-category icons', () => {
  const icon = readFileSync('src/components/RuleToneIcon.vue', 'utf8')
  for (const filename of ['spell-vortex.png', 'spell-enchantment.png', 'spell-hex.png', 'spell-conveyance.png', 'spell-missile.png', 'spell-assailment.png']) {
    assert.match(icon, new RegExp(filename.replace('.', '\\.')))
  }
  assert.match(icon, /magical\\s\+vortex|magical\\s\+vortex/)
  assert.match(icon, /magic\\s\+missile|magic\\s\+missile/)
})


test('Special Rule and Magical Item type keywords are neutral footer pills', () => {
  const card = readFileSync('src/components/RuleAbilityCard.vue', 'utf8')
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(card, /old-rule-keywords[\s\S]*rule-kind-pill/)
  assert.match(styles, /\.old-rule-keywords \.rule-kind-pill\{[^}]*border-color:var\(--line\)[^}]*background:var\(--paper-2\)[^}]*color:var\(--ink-soft\)/s)
})

test('Sentence-like rule callouts are split from the title and rendered as linked keywords', () => {
  const card = readFileSync('src/components/RuleAbilityCard.vue', 'utf8')
  const presentation = readFileSync('src/domain/rulePresentation.ts', 'utf8')
  assert.match(card, /splitRuleCallout\(props\.rule\.name\)/)
  assert.match(presentation, /doesn\['’\]\?t/)
  assert.match(card, /rows\.push\(\{ label: ruleCalloutLabel\(displayRule\.value\.callout\), path: ownPath \}\)/)
  assert.match(presentation, /export function ruleCalloutLabel/)
  assert.match(card, /RouterLink v-if="ownRulePath" class="rule-kind-pill"/)
  assert.match(card, /old-rule-name">\{\{ displayRule\.title \}\}/)
})

test('Equipped magical weapons add Magical Attacks to profile keywords', () => {
  assert.match(unitView, /const hasMagicalAttacks = selectedMagicWeapons\.value\.length > 0/)
  assert.match(unitView, /label: 'Magical Attacks', path: '\/special-rules\/magical-attacks'/)
})

test('Mount armour characteristic displays rider contribution instead of a standalone save', () => {
  assert.match(unitView, /if \(isMountProfileName\(sourceName\)\)[\s\S]*7 - save[\s\S]*profile\.Sv = contribution > 0 \? `\+\$\{contribution\}` : '—'/)
})

test('Explicit Big Uns profile replaces the ordinary base profile when selected', () => {
  assert.match(unitView, /const explicitBigUns = baseProfiles\.some/)
  assert.match(unitView, /if \(bigUnsSelected\.value\)[\s\S]*baseProfiles = baseProfiles\.filter/)
  assert.match(unitView, /baseProfiles = baseProfiles\.filter\(\(row\) => !\/\\bBig/)
})

test('Roster shows percentages next to point totals and allowance requirements', () => {
  const builder = readFileSync('src/views/ListBuilderView.vue', 'utf8')
  assert.match(builder, /rosterPercentUsed/)
  assert.match(builder, /remainingPercent/)
  assert.match(builder, /categoryPercent\(category\)/)
  assert.match(builder, /qualifier: 'Needed'/)
  assert.match(builder, /qualifier: 'Maximum'/)
  assert.match(builder, /categoryAllowancePointsText\(category\)/)
  assert.match(builder, /\{\{ categorySelectedCount\(category\) \}\} Selected/)
  assert.match(builder, /\{\{ categoryPercent\(category\) \}\}% \/ \{\{ categoryAllowance\(category\)\?\.percent \}\}%/)
})

test('Settings hierarchy keeps Report first, reset and Themes inside Display, Donations before Data & Content, and removes Local', () => {
  const settings = readFileSync('src/views/SettingsView.vue', 'utf8')
  const report = settings.indexOf('REPORT BUGS &amp; ISSUES')
  const display = settings.indexOf('>DISPLAY<')
  const donations = settings.indexOf('>DONATIONS<')
  const data = settings.indexOf('DATA &amp; CONTENT')
  assert.ok(report >= 0 && display > report && donations > display && data > donations)
  assert.match(settings, /<strong>Themes<\/strong>/)
  assert.match(settings, /<strong>Reset local settings<\/strong>/)
  assert.doesNotMatch(settings, />LOCAL</)
})

test('List setup uses Battle Composition and Battle Composition Options terminology', () => {
  const create = readFileSync('src/views/CreateListView.vue', 'utf8')
  const builder = readFileSync('src/views/ListBuilderView.vue', 'utf8')
  assert.match(create, />Battle Composition\s*</)
  assert.match(create, /Battle Composition Options/)
  assert.match(builder, />Battle Composition<select/)
  assert.match(builder, /Battle Composition Options/)
})

test('Composition option labels use the clarified magic and unit wording', () => {
  const data = readFileSync('src/data/listBuilder.ts', 'utf8')
  assert.match(data, /Magical Category - Limit 1/)
  assert.match(data, /Magical Item - Point Limit 75 pts/)
  assert.match(data, /Magical Item - Point Limit 50 pts/)
  assert.match(data, /Allow Allied Units/)
  assert.match(data, /Allow Mercenary Units/)
})

test('Settings contains bug-reporting and donation placeholders', () => {
  const settings = readFileSync('src/views/SettingsView.vue', 'utf8')
  assert.match(settings, /REPORT BUGS &amp; ISSUES/)
  assert.match(settings, /DONATIONS/)
  assert.match(settings, /No payment functionality is active in this build/)
})

test('Every page header carries the WIP banner and enlarged Old.dex brand', () => {
  const header = readFileSync('src/components/AppHeader.vue', 'utf8')
  const styles = readFileSync('src/styles.css', 'utf8')
  assert.match(header, /wip-banner[\s\S]*work in progress/)
  assert.match(styles, /\.brand\{font-size:calc\(32px \+ var\(--font-offset\)\)/)
})

test('In-app and GitHub changelogs share the same canonical entries', () => {
  const data = readFileSync('src/data/changelog.ts', 'utf8')
  const markdown = readFileSync('CHANGELOG.md', 'utf8')
  const entries = [...data.matchAll(/\{ version: '([^']+)', title: '([^']+)', notes: \[([\s\S]*?)\n  \] \},/g)]
  assert.ok(entries.length >= 10)
  for (const [, version, title, noteBlock] of entries) {
    assert.match(markdown, new RegExp(`## Alpha Build ${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`))
    assert.ok(markdown.includes(title))
    for (const note of [...noteBlock.matchAll(/'([^']*(?:’[^']*)*)',/g)].map((match) => match[1])) assert.ok(markdown.includes(note))
  }
})

test('Rule callout cleanup is shared with roster/profile keyword labels', () => {
  const presentation = readFileSync('src/domain/rulePresentation.ts', 'utf8')
  const card = readFileSync('src/components/RuleAbilityCard.vue', 'utf8')
  const unit = readFileSync('src/views/UnitView.vue', 'utf8')
  assert.match(presentation, /export function splitRuleCallout/)
  assert.match(presentation, /export function ruleDisplayName/)
  assert.match(card, /from '\.\.\/domain\/rulePresentation'/)
  assert.match(unit, /label: ruleDisplayName\(rule\.name\)/)
  assert.doesNotMatch(card, /function splitRuleCallout\(value: string\)/)
})
