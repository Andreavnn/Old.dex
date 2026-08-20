Old.dex v0.51 Vercel build-fix patch

Replace the matching repository files with the files in this package:
- src/services/armyData.ts
- src/views/RuleIndexGroupView.vue
- src/views/UnitView.vue

Fixes the TypeScript errors reported by Vercel:
- CompositionRuleCatalog is now re-exported by services/armyData.ts.
- Removed unused useRouter/router in RuleIndexGroupView.vue.
- Removed unused weaponIsUniversalHandWeapon helper/import in UnitView.vue.
- Removed stale magicItemRuleCards reference from roster specialRules serialization; magic items remain separate from Special Rules as intended.

Local verification after patch:
- ODX static analysis: PASS
- Regression tests: 79/79 PASS

Vercel Build Command override should remain OFF. Vercel detects Vite and runs npm run build from package.json automatically.
