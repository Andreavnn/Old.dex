import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const resolver = read('src/services/owbRuleResolver.ts')
const audit = read('src/services/owbDataAudit.ts')
const builder = read('src/data/liveBuilderUnits.ts')
const reference = read('src/services/liveUnitReference.ts')
const language = read('src/services/language.ts')
const app = read('src/App.vue')
const armyData = read('src/services/armyData.ts')
const listBuilder = read('src/views/ListBuilderView.vue')
const unit = read('src/views/UnitView.vue')
const listView = read('src/views/ListView.vue')

test('v0.63 uses Old World Builder rules-index-export and rules-map as the canonical identity layer', () => {
  assert.match(resolver, /rules-index-export\.json/)
  assert.match(resolver, /rules-map\.js/)
  assert.match(resolver, /const additionalOWBRules/)
  assert.match(resolver, /export const synonyms/)
  assert.match(resolver, /normalizeOwbRuleName/)
  assert.match(resolver, /const synonym = catalog\.synonyms\[candidate\]/)
  assert.match(app, /loadOwbRuleCatalog/)
  assert.match(armyData, /loadOwbRuleCatalog\(true\)/)
  assert.match(armyData, /clearOwbRuleCatalog\(\)/)
  assert.match(resolver, /Old World Builder rule index was incomplete/)
  assert.match(resolver, /readPersistedCatalog\(true\)/)
})

test('v0.63 copies OWB rule-name normalization rather than guessing slugs first', () => {
  assert.ok(resolver.includes(".replace(/ *\\([^)]*\\) */g, '')"))
  assert.ok(resolver.includes(".replace(/\\{/g, '')"))
  assert.ok(resolver.includes(".replace(/\\[/g, '')"))
  assert.match(reference, /resolveOwbRuleFromCatalog\(ruleCatalog, ruleSourceName\)/)
  assert.match(reference, /resolveOwbRuleFromCatalog\(catalog, name\)/)
})

test('v0.63 gets model and mount profiles from OWB indexed stats before page scraping', () => {
  assert.match(builder, /indexedProfileRows/)
  assert.match(builder, /owbStatsRows/)
  assert.match(builder, /profile: indexed\.rows\[0\]\?\.profile \|\| blankProfile\(\)/)
  assert.match(reference, /const indexedProfiles = owbProfileRows/)
  assert.match(reference, /const indexed = owbProfileRows\(resolvedProfile\?\.entry/)
  assert.match(reference, /rawUnitForResolvedReference/)
  assert.match(reference, /referencedRaw\?\.specialRules/)
})

test('v0.63 makes source list parsing resolver-aware so punctuation inside canonical names is preserved', () => {
  assert.match(resolver, /if \(catalog && resolveOwbRuleFromCatalog\(catalog, clean\)\) return \[clean\]/)
  assert.match(resolver, /round === 0 && square === 0 && brace === 0/)
  assert.match(resolver, /Longest match wins/)
  assert.match(resolver, /resolveOwbRuleFromCatalog\(catalog, candidate\)/)
  assert.match(builder, /splitOwbSourceList/)
  assert.match(builder, /splitWeaponDescriptor\(descriptor, catalog\)/)
})

test('v0.63 includes a whole-army resolver audit for unresolved units mounts weapons and rules', () => {
  assert.match(audit, /auditOwbArmyData/)
  assert.match(audit, /kind: 'unit' \| 'mount' \| 'weapon' \| 'rule'/)
  assert.match(audit, /resolutionRate/)
  assert.match(audit, /expectedPrefix/)
})

test('v0.63 language preference selects the same localized fields used by OWB and reloads live data', () => {
  assert.match(language, /sourceCode: 'cn'/)
  assert.match(language, /localizedSourceText/)
  assert.match(language, /row\[`name_\$\{code\}`\]/)
  assert.match(builder, /displayText\(raw\)/)
  assert.match(builder, /sourceName:/)
  assert.match(listBuilder, /language\.value\], loadCatalog/)
  assert.match(unit, /language\.value\], \(\) =>/)
  assert.match(listView, /watch\(language, \(\) => \{ void loadProfiles\(\) \}\)/)
})

test('v0.63 follows OWB army-composition overrides and filters composition-scoped options', () => {
  assert.match(builder, /function sourceAppliesToComposition/)
  assert.match(builder, /if \(!sourceAppliesToComposition\(item, compositionId\)\) continue/)
  assert.match(builder, /compositionRecord\(raw, compositionId\)\?\.specialRules/)
  assert.match(builder, /const scopedLores = Array\.isArray\(entry\?\.lores\)/)
  assert.match(builder, /compositionModelBounds\(raw, compositionId\)/)
  assert.match(reference, /army-composition overrides/)
})

test('v0.63 keeps source-generated option IDs stable while names are localized', () => {
  assert.match(builder, /function selectableId\(item: RawBuilderItem, prefix: string\)/)
  assert.match(builder, /slug\(name\)/)
  assert.doesNotMatch(builder, /function selectableId[\s\S]{0,180}slug\(sourceName\)/)
  assert.match(builder, /sourceName,/) 
})
