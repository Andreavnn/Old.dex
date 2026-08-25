/**
 * Canonical semantic classification for selections imported from Old World Builder.
 *
 * Critical invariant: a documentation URL never decides what a selection *is*.
 * OWB source structure + the selection's own name determine semantics. Rule paths
 * are references only and may point at broad sections such as /weapons-of-war/shield.
 */
export type OwbSourceSection = 'equipment' | 'armor' | 'options' | 'command' | 'mounts' | 'mount-option' | 'synthetic'
export type CanonicalSelectionKind = 'weapon' | 'shield' | 'armour' | 'mount' | 'role' | 'upgrade'

const shieldPattern = /\b(?:shield|shields|buckler|bucklers)\b/i
const armourPattern = /\b(?:armour|armor|barding|plate|mail|hauberk|helm|helmet)\b/i
const rolePattern = /\b(?:general|battle standard bearer|standard bearer|champion|musician|boss|captain|sergeant)\b/i

// Deliberately name-based. This is the canonical semantic vocabulary for actual
// weapons in OWB source data; it is not inferred from a rule/document path.
const weaponPattern = /\b(?:weapon|weapons|spear|spears|pike|pikes|glaive|glaives|halberd|halberds|lance|lances|flail|flails|whip|whips|staff|stave|staves|sword|swords|blade|blades|axe|axes|hammer|hammers|mace|maces|maul|mauls|club|clubs|dagger|daggers|knife|knives|cleaver|cleavers|choppa|choppas|stabba|stabbas|scythe|scythes|pick|picks|ironfist|ironfists|claw|claws|talon|talons|fist|fists|bow|bows|crossbow|crossbows|longbow|longbows|shortbow|shortbows|warbow|warbows|javelin|javelins|throwing|sling|slings|pistol|pistols|handgun|handguns|gun|guns|rifle|rifles|firearm|firearms|blowpipe|blowpipes|bomb|bombs|grenade|grenades|bolt thrower|stone thrower|catapult|ballista|trebuchet|mortar|lobber|doom diver|cannon|morning star|blunderbuss|khopesh|khopeshes|fang-filled gob|lamprey'?s bite|sorrow'?s end|tintinnabulation|brazier|ball\s*&\s*chain)\b/i

function compact(value: string) {
  return String(value || '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
}

export function isShieldSemanticName(value: string) {
  return shieldPattern.test(compact(value))
}

export function isArmourSemanticName(value: string) {
  const name = compact(value)
  return !isShieldSemanticName(name) && armourPattern.test(name)
}

export function isWeaponSemanticName(value: string) {
  const name = compact(value)
  if (!name || isShieldSemanticName(name) || isArmourSemanticName(name)) return false
  return weaponPattern.test(name)
}

export function canonicalSelectionKind(name: string, source: OwbSourceSection): CanonicalSelectionKind {
  const value = compact(name)
  if (isShieldSemanticName(value)) return 'shield'
  if (source === 'armor' || isArmourSemanticName(value)) return 'armour'
  if (source === 'mounts') return 'mount'
  if (source === 'command' && rolePattern.test(value)) return 'role'
  if (isWeaponSemanticName(value)) return 'weapon'
  return 'upgrade'
}

export function partitionDescriptorParts(parts: string[], source: OwbSourceSection) {
  const weaponParts: string[] = []
  const nonWeaponParts: string[] = []
  for (const part of parts) {
    if (canonicalSelectionKind(part, source) === 'weapon') weaponParts.push(part)
    else nonWeaponParts.push(part)
  }
  return { weaponParts, nonWeaponParts }
}
