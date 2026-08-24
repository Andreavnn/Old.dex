import type { ChangelogEntry } from './changelog'

export const changelogV035: ChangelogEntry = {
  version: '0.35',
  title: 'Compiled match intelligence and installed-app launch audio',
  notes: [
    'Rebuilt match guidance around a central rule-intelligence compiler. Roster rules, magical items, scenario rules, battlefield effects, army/battle compositions and prepared magic are now interpreted once into explicit operational events before any match screen decides what to display.',
    'Removed broad phase-name matching as the primary routing method. A rule is no longer repeated in a step merely because its text mentions that phase; explicit timing wins, operational mechanics refine broad phase wording, dependent continuation text stays with its triggering event, and ambiguous passive phase references fail closed instead of becoming tasks.',
    'Made Old.dex order-of-work steps first-class timing targets even when the source book combines them differently. Impetuous and equivalent tests route to Required Charge Tests, while their Pass/Fail result is carried forward to the normal Declare Charges checklist as a MUST CHARGE IF POSSIBLE state.',
    'Separated rules that create a Required Charge Test from rules that only modify one. Modifiers such as Warband/Quell-style effects can be shown with the test procedure without incorrectly causing every model that has the modifier to make a test.',
    'Allowed one source rule to generate multiple match events only when it contains genuinely separate mechanics. Charge-range/Charge-roll modifiers can therefore appear with Charge Moves while an Impetuous grant from the same rule appears in Required Charge Tests, without duplicating unrelated rule text across the phase.',
    'Rebuilt Deployment and Start of Round on the same compiled knowledge model so only deployment/reserve rules and actual Start of Round triggers are shown in those workflows. Friendly and imported enemy roster timing is interpreted relative to the owner of each rule.',
    'Corrected maximum declaration range to Movement + 6 before explicit maximum-range bonuses; Swiftstride contributes its current +3 maximum-range increase and other detected maximum-range modifiers are added once.',
    'Kept Wizard/Priest magic tied to its operational spell timing: Enchantment/Hex in Conjuration, Conveyance in Remaining Moves, Magic Missile/Magical Vortex in Special Shooting Actions and Assailment in Combat, with timing-text fallback for abilities that do not use those standard type labels.',
    'Added an installed-application launch scene using the supplied Old.dex boot audio. Normal browser-tab launches remain silent, and Settings now includes an Installed app launch audio switch that can disable the sound.',
    'Bumped the PWA shell cache and included the launch audio in the offline application core so installed Old.dex can use it without requiring a fresh network request at boot.',
  ],
}
