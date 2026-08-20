export type RuleSection = {
  name: string
  slug: string
  sourcePath: string
  topics: string[]
  featured?: boolean
}

export type SupportPage = {
  name: string
  slug: string
  sourcePath: string
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const ruleSections: RuleSection[] = [
  {
    name: 'Overview of the Game', slug: 'overview-of-the-game', sourcePath: '/overview-of-the-game', featured: true,
    topics: ['Muster Your Forces!', 'Choose Scenario', 'Set up the Battlefield', 'Deploy Armies', 'To Battle!', 'Aftermath'],
  },
  {
    name: 'Model Profiles', slug: 'model-profiles', sourcePath: '/model-profiles',
    topics: ['Characteristics Profile', 'Movement (M)', 'Weapon Skill (WS)', 'Ballistic Skill (BS)', 'Strength (S)', 'Toughness (T)', 'Wounds (W)', 'Initiative (I)', 'Attacks (A)', 'Leadership (Ld)', 'Split Profiles', 'Characteristics of Zero', 'Characteristic Tests', 'Leadership Tests', 'Modifying Characteristics', 'Points Value', 'Troop Type', 'Base Size', 'Unit Size', 'Armour Value', 'Equipment', 'Magic', 'Options', 'Special Rules', 'Magic Items', 'Unique Equipment'],
  },
  {
    name: 'Forming Units', slug: 'forming-units', sourcePath: '/forming-units',
    topics: ['Formation Types', 'Close Order Formation', 'Unit Shape', 'Combat Order', 'Marching Column', 'Disrupted Units'],
  },
  {
    name: 'Removing Casualties', slug: 'removing-casualties', sourcePath: '/removing-casualties',
    topics: ['Single Wound Models', 'Multiple Wound Models', 'Removing Casualties From Units', 'Stepping Forward', 'Single Rank Units'],
  },
  {
    name: 'Model & Unit Facing', slug: 'model-and-unit-facing', sourcePath: '/model-and-unit-facing',
    topics: ['Line of Sight', 'Obscured Line of Sight'],
  },
  {
    name: 'Troop Types at a Glance', slug: 'troop-types-at-a-glance', sourcePath: '/troop-types-at-a-glance',
    topics: ['Categories of Troop Type', 'Troop Type Table', 'Unit Strength'],
  },
  {
    name: 'Magic', slug: 'magic', sourcePath: '/magic', featured: true,
    topics: ['Wizards', 'Levels of Wizardry', 'Lores of Magic', 'Spells & Spell Generation', 'Spell Categories', 'Enchantment', 'Hex', 'Conveyance', 'Magic Missiles', 'Magical Vortex', 'Assailment', 'Casting Spells', 'Choosing a Target', "Range 'Self' Spells", 'Casting Roll, Casting Result & Casting Value', 'Magic Resistance (-X)', 'Miscasts & Perfect Invocations', 'Perfect Invocations', 'Miscast', 'Miscast Table', 'Bound Spells', 'Dispel', 'Types of Dispel', 'Wizardly Dispel', 'Fated Dispel', 'Dispel Roll & Dispel Result', 'Unbinding', 'Spell Resolution', 'Spell Duration', 'Remains in Play', 'Dispelling Remains in Play Spells', 'Wizards & Armour'],
  },
  {
    name: 'The Turn Sequence', slug: 'the-turn-sequence', sourcePath: '/the-turn-sequence',
    topics: ['A Game of Rounds & Turns', 'First Turn', 'Game Length', 'Active & Inactive Player', 'The Turn Sequence'],
  },
  {
    name: 'The Strategy Phase', slug: 'the-strategy-phase', sourcePath: '/the-strategy-phase',
    topics: ['The Strategy Phase Sequence', 'Start of Turn', 'Command', 'Conjuration', 'Rally Fleeing Units', 'Rallied Units', 'Insurmountable Losses', 'Fleeing Units'],
  },
  {
    name: 'The Movement Phase', slug: 'the-movement-phase', sourcePath: '/the-movement-phase', featured: true,
    topics: ['The Movement Phase Sequence', 'The 1" Rule', 'Declare Charges & Charge Reactions', 'Who Can Charge?', 'Charging More than One Unit', 'Charge Reactions', 'Hold', 'Stand & Shoot', 'Flee', 'Charge Reactions & Multiple Charging Units', 'Charge Moves', 'Determine Charge Range', 'The Charge Move', 'Maximum Possible Charge Range', 'Failed Charge', 'Compulsory Moves', 'Fleeing Units', 'Other Types of Compulsory Movement', 'Remaining Moves'],
  },
  {
    name: 'Movement in Detail', slug: 'movement-in-detail', sourcePath: '/movement-in-detail',
    topics: ['Basic Movement', 'Marching', 'Enemy Sighted', 'Manoeuvres', 'Wheel', 'Turn', 'Move Backwards', 'Move Sideways', 'Redress the Ranks', 'Reform', 'Pivoting', 'The Ends of the World', 'The Charge Move', 'Manoeuvring During a Charge', 'Aligning to the Enemy', 'Flank & Rear Charges', 'Resolving Uncertainties', 'Unable to Align', 'Disordered Charge', 'Charging Through Terrain', 'Charging a Fleeing Enemy', 'Running Down the Foe', 'Redirecting a Charge', 'Multiple Charging Units', 'Multiple Charge Targets', 'Accidental Contact', 'Halting a Charge', 'Continuing Ahead', 'Flee!', 'Direction of Flight', 'The Flee Move', 'Destruction of a Fleeing Unit', 'Give Ground & Fall Back in Good Order', 'Give Ground', 'Fall Back in Good Order', 'Oddball Stuff', 'Conveyance Spells', 'Lone Models', 'Moving off the Battlefield', 'Reinforcements', 'Terrain & Movement'],
  },
  {
    name: 'The Shooting Phase', slug: 'the-shooting-phase', sourcePath: '/the-shooting-phase', featured: true,
    topics: ['The Shooting Phase Sequence', 'Choose Unit & Declare Target', 'Who Can Shoot?', 'Check Line of Sight', 'Check Range', 'Declare Target', 'How Many Shots?', "We Can't All Shoot!", 'Roll to Hit', 'Fast Dice Rolling', 'BS of 6 or Higher', 'To Hit Modifiers', 'Range & Movement Modifiers', 'Moving and Shooting', 'Firing at Long Range', 'Standing and Shooting', 'Cover Modifiers', 'Target Behind Partial Cover', 'Target Behind Full Cover', '7+ to Hit', 'Roll to Wound & Make Armour Saves', 'Roll to Wound', 'Too Tough to Wound', 'Make Armour Saves', 'Determining Armour Value', 'Armour Piercing', 'Ward Saves', 'More than One Save', 'Remove Casualties & Make Panic Tests', 'Make Panic Tests', 'Fall Back or Flee', 'Shooting into Combat', 'Automatic Hits', 'Hits that Inflict Multiple Wounds', 'Instant Kills'],
  },
  {
    name: 'The Combat Phase', slug: 'the-combat-phase', sourcePath: '/the-combat-phase', featured: true,
    topics: ["The Combat Phase Sequence", "End of Turn", "Choose & Fight Combat", "Choose Combat & Determine Who Can Fight", "Who Can Fight?", "Base Contact", "The Fighting Rank", "Supporting Attacks", "How Many Attacks?", "Who Strikes First?", "Charging Units", "Disordered Charges", "Simultaneous Combat", "We Can't All Fight!", "Multiple Units In Combat", "Dividing Attacks", "Fighting on Multiple Fronts", "Roll to Hit (Combat)", "Fast Dice Rolling (Combat)", "Roll to Wound & Make Armour Saves (Combat)", "Roll to Wound (Combat)", "Make Armour Saves (Combat)", "Determining Armour Saves (Combat)", "Remove Casualties (Combat)", "Stepping Forward & Closing In", "Set Casualties Aside", "Excess Casualties", "Fight On!", "Calculate Combat Result", "Combat Result Score", "Combat Result Table", "Unsaved Wounds Inflicted", "Rank Bonus", "Standards", "Flank & Rear Attacks", "The High Ground", "Overkill (Combat)", "Other Bonuses", "Who is the Winner?", "Drawn Combat", "Combat Results & Multiple Units In Combat", "Rank Bonus in Multiple Combats", "Standards (Multiple Combats)", "Flank & Rear Attacks (Multiple Combats)", "The High Ground (Multiple Combats)", "Other Bonuses (Multiple Combats)", "Break Test", "Loser Breaks & Flees", "Loser Falls Back In Good Order", "1\" Apart (Combat)", "Loser Gives Ground", "Surrounded", "Follow Up & Pursuit", "Restrain & Reform", "Follow Up", "Change Facing", "Pursuit", "The Pursuit Move", "Overrun", "Unable to Follow Up or Pursue", "Still Engaged", "Unable to Move", "Catching the Curs!", "Pursuit into an Obstacle", "Pursuit off the Battlefield", "Pursuit into a Fresh Enemy", "Pursuit into a Fleeing Enemy", "Pursuit into a New Combat", "Oddball Stuff (Combat)", "Assailment Spells", "Shrinking Units", "No More Foes", "Incomplete Ranks", "Split Profiles (Combat)", "Different Weapons", "Characteristics of Zero (Combat)", "Terrain & Combat", "Open Ground & Hills (Combat)", "Difficult Terrain (Combat)", "Dangerous Terrain & Woods", "Impassable Terrain (Combat)", "Linear Obstacles", "Low Linear Obstacles (Combat)", "Defended Low Linear Obstacles (Combat)", "High Linear Obstacles (Combat)", "Battlefield Decoration (Combat)"],
  },
  {
    name: 'The Psychology of War', slug: 'the-psychology-of-war', sourcePath: '/the-psychology-of-war',
    topics: ['Panic Tests', 'No Need for Hysterics', 'Common Causes of Panic', 'Heavy Casualties', 'Nearby Friend Destroyed', 'Nearby Friend Flees Combat', 'Fled Through'],
  },
  {
    name: 'Special Rules', slug: 'special-rules', sourcePath: '/special-rules', featured: true,
    topics: ['What are Special Rules?', 'Flee To Safety', 'Universal Special Rules', 'Army Special Rules', 'Unique Special Rules', 'What Special Rules Does it Have?', 'Rule Priority', 'Cumulative Special Rules', 'Ambushers', 'Armour Bane (X)', 'Armoured Hide (X)', 'Breath Weapon', 'Chariot Runners', 'Close Order', 'Counter Charge', 'Cumbersome', 'Detachment', 'Dragged Along', 'Drilled', 'Ethereal', 'Evasive', 'Extra Attacks (+X)', 'Fast Cavalry', 'Fear', 'Feigned Flight', 'Fight in Extra Rank', 'Fire & Flee', 'First Charge', 'Flaming Attacks', 'Flammable', 'Fly (X)', 'Frenzy', 'Furious Charge', 'Hatred (X)', 'Horde', 'Howdah', 'Ignores Cover', 'Immune to Psychology', 'Impact Hits (X)', 'Impetuous', 'Killing Blow', 'Large Target', 'Levies', 'Loner', 'Magical Attacks', 'Magic Resistance (-X)', 'Mercenaries', 'Monster Handlers', 'Monster Slayer', 'Motley Crew', 'Move & Shoot', 'Move or Shoot', 'Move Through Cover', 'Multiple Shots (X)', 'Multiple Wounds (X)', 'Open Order', 'Poisoned Attacks', 'Ponderous', 'Quick Shot', 'Rallying Cry', 'Random Attacks', 'Random Movement', 'Regeneration (X+)', 'Regimental Unit', 'Requires Two Hands', 'Reserve Move', 'Scouts', 'Shieldwall', 'Skirmishers', 'Stomp Attacks (X)', 'Strike First', 'Strike Last', 'Stubborn', 'Stupidity', 'Swiftstride', 'Terror', 'Timmm-berrr!', 'Unbreakable', 'Unstable', 'Vanguard', 'Veteran', 'Volley Fire', 'Warband', 'Warp-spawned'],
  },
  {
    name: 'Unusual Formations', slug: 'unusual-formations', sourcePath: '/unusual-formations',
    topics: ['Adopting & Changing Formation', 'Open Order Formation', 'Highly Manoeuvrable', 'Quick Turn', 'Dispersed Ranks', 'Unit Shape', 'Combat Order', 'Marching Column', 'Skirmish Formation', '1" Apart', 'Coherency', 'Facing & Line of Sight', 'Movement & Manoeuvre', 'Moving Through Skirmishers', 'Skirmishers as Reinforcements', 'Skirmishers & Shooting', 'Enemy Fire', 'Skirmishers & Panic', 'Skirmishers in Combat', 'Skirmishers & Rank Bonus', 'Skirmishers & Disruption', 'Characters Joining Skirmishers', 'Skirmishers & Charging', 'Formed Units Charging Skirmishers', 'Skirmishers Charging Skirmishers'],
  },
  {
    name: 'Troop Types in Detail', slug: 'troop-types-in-detail', sourcePath: '/troop-types-in-detail',
    topics: ['Categories of Troop Type', 'Characters', 'Troop Type Tables', 'Infantry', 'Regular Infantry', 'Press of Battle', 'Massed Infantry', 'Parry', 'Heavy Infantry', 'Steady in the Ranks', 'Monstrous Infantry', 'Clumsy', 'Swarms', 'Insignificant', 'No One Cares', 'Undisciplined', 'Cavalry', 'Light Cavalry', 'Split Profile', 'Cavalry Support', 'Heavy Cavalry', 'Monstrous Cavalry', 'War Beasts', 'Chariots', 'Light Chariots', 'Iron Shod Wheels', 'Churning Wheels', 'Firing Platform', 'Heavy Chariots', 'Scythed Wheels', 'Lumbering', 'Monsters', 'Monstrous Creatures', 'Behemoths', 'Thunderstomp', 'War Machines', "We're Not Paid to Fight", 'Weapon of War'],
  },
  {
    name: 'Command Groups', slug: 'command-groups', sourcePath: '/command-groups',
    topics: ["What's in a Title?", 'Position Within the Unit', 'Not Enough Room', 'Make Way!', 'Champions', 'Characteristics', 'Equipment', 'Champions & Shooting', 'Champions in Combat', 'Champions & Challenges', 'Champions as Casualties', 'Look Out, Sir!', 'Standard Bearers', 'Combat Result Bonus', 'Trophies of War', 'Musicians', 'Onwards to Victory!', 'Steadying Rhythm', 'Quick Time', 'Musicians as Casualties'],
  },
  {
    name: 'Characters', slug: 'characters', sourcePath: '/characters',
    topics: ['Character Models', 'Command Range', 'General & Battle Standard', 'The General', 'Selecting Your General', 'Inspiring Presence', 'The Battle Standard', 'The Battle Standard Bearer Model', 'Combat Result Bonus', 'Hold Your Ground', 'Characters & Troop Type', 'Mounted Characters', 'Characters & Cavalry Mounts', 'Characters & Ridden Monsters', 'Characters & Chariot Mounts', 'Characters & Formations', 'Lone Characters', 'Evade', 'Targeting Lone Characters', 'Characters & Units', 'Positioning Characters', 'Leaving a Unit', 'Movement', 'Moving Through the Ranks', 'Characters & Shooting', 'Enemy Shooting', 'Look Out, Sir!', 'Characters in Combat', 'Too Many Characters', 'Excess Wounds', 'Challenges', 'Issuing A Challenge', 'Accepting a Challenge', 'Refusing a Challenge', 'Nowhere to Run', 'Fighting A Challenge', 'Overkill', 'To The Death!', 'Challenges & Mounts'],
  },
  {
    name: 'Weapons of War', slug: 'weapons-of-war', sourcePath: '/weapons-of-war', featured: true,
    topics: ['Weapon Profiles', 'Combat Weapons', 'More Than One Combat Weapon', 'Hand Weapon', 'Two Hand Weapons/Additional Hand Weapon', 'Flail', 'Great Weapon', 'Halberd', 'Morning Star', 'Whip', 'Spears', 'Lance', 'Cavalry Spear', 'Throwing Spear', 'Thrusting Spear', 'Missile Weapons', 'More than One Missile Weapon', 'Bows', 'Longbow', 'Shortbow', 'Warbow', 'Black Powder Weapons', 'Handgun', 'Pistol', 'Brace of Pistols', 'Repeater Handgun', 'Repeater Pistol', 'Crossbows', 'Crossbow', 'Repeater Crossbow', 'Repeater Handbow', 'Thrown Weapons', 'Throwing Weapons', 'Javelin', 'Sling', 'Throwing Axe', 'Armour', 'Armour Value', 'Light Armour', 'Heavy Armour', 'Full Plate Armour', 'Maximum Armour Value', 'No Armour', 'Unusual Armour', 'Additional Equipment', 'Shield', 'Barding', 'Wizards & Armour'],
  },
  {
    name: 'War Machines', slug: 'war-machines', sourcePath: '/war-machines',
    topics: ['Basing War Machines', 'Bolt Throwers', 'Through & Through', 'Rapid Fire', 'Stone Throwers', 'Bombardment', 'Indirect Fire', 'Stone Thrower Misfire Table', 'Cannon', 'Cannon Fire', 'Grapeshot', 'Needs More Nails', 'Organ Guns', 'Multi-Barrelled', 'Mortars', 'Fire Throwers', 'Column of Fire', 'Black Powder Misfire Table'],
  },
  {
    name: 'Battlefield Terrain', slug: 'battlefield-terrain', sourcePath: '/battlefield-terrain',
    topics: ['How Much Terrain?', 'The Size of Things', 'Placing Terrain', 'Categories of Terrain', 'Open Ground', 'Difficult Terrain', 'Dangerous Terrain', 'Impassable Terrain', 'Low & High Linear Obstacles', 'Low Linear Obstacles', 'Defended Low Linear Obstacles', 'High Linear Obstacles', 'Woods', 'Woodland Boundaries', 'Arboreal Gloom', 'Hills', 'Vantage Point', 'Beyond the Crest', 'Battlefield Decoration', 'Combining Terrain Categories', 'Special Features', 'Using Special Features', 'Placing Special Features', 'Controlling a Special Feature', 'Benefits of Control', 'Proximity', 'Occupancy', 'Arcane Monolith', 'Monument of Glory', 'Dark Ruins', 'Tower', 'Random Terrain Generator', 'Wasteland Terrain Generator', 'Shadowlands Terrain Generator', 'Scattered Terrain Placement', 'Linear Terrain Features', 'Buildings'],
  },
  {
    name: 'Warhammer Armies', slug: 'warhammer-armies', sourcePath: '/warhammer-armies',
    topics: ['Points Values & Size of Game', 'Recommended Size of Game', 'Minimum Three Units', 'The General', 'The Muster List', 'Army Lists', 'Army Composition Lists', 'Grand Army', 'Army of Infamy', 'Understanding Army Composition Lists', 'Percentages', 'Number of Units', 'Named Characters', 'Mercenaries', 'Misbehaving Mercenaries', 'Allied Contingents', 'Creating an Allied Contingent', 'Allied Contingent Special Rules', 'Types of Alliance', 'Uneasy Allied Contingents', 'Suspicious Allied Contingents', 'Regimental Units & Detachments', 'Using Regiments & Detachments', 'Creating a Regimental Unit', 'Creating a Detachment', 'Detachment Special Rules', 'Regimental Deployment', 'Regimental Leadership', 'Regimental Psychology', 'Supporting Actions', 'Supporting Charge', 'Supporting Fire', 'Dogs of War'],
  },
  {
    name: 'Warhammer Battles', slug: 'warhammer-battles', sourcePath: '/warhammer-battles',
    topics: ['Prepare for Battle', 'Setting up your Battlefield', 'Size of Battlefield', 'Placing Terrain', 'Deployment', 'Alternating Units', 'Reserves', 'First Turn', 'Game Length', 'Conceding', 'Time Limit', 'Victory Points', 'Dead or Fled', 'The King is Dead', 'Trophies of War', 'Scenario Objectives', 'Special Features', 'Pitched Battles', 'Historical Recreation', 'Choosing a Pitched Battle Scenario', 'Open Battle', 'Break Point', 'Flank Attack', 'Meeting Engagement', 'Mountain Pass', 'Command & Control', 'Multi-player Games'],
  },
  {
    name: 'Campaign Battles', slug: 'campaign-battles', sourcePath: '/campaign-battles',
    topics: ['Campaign Trees', 'League Campaigns', 'Scoring', 'Taking It Further', 'Path to Glory Campaign', 'The Pursuit of Glory', 'Setting up the Campaign', 'Running the Campaign', 'Veteran Abilities', 'Battlefield Losses', 'Seasoned Commanders', 'Promotion or Death'],
  },
  {
    name: 'Narrative Battles', slug: 'narrative-battles', sourcePath: '/narrative-battles',
    topics: ['What is a Narrative Battle?', 'Historical Recreations', 'Custom Scenarios', 'Narrative Scenarios', 'Open Play', 'Armies of Imagination', 'Think Of Them More As Guidelines', 'The Games Master', 'The Role of a GM', 'Forging a Narrative', 'Narrative Locations', 'Narrative Motives', 'Linked Battles', 'Campaign Narrative', 'The Dark Monolith', 'War in Westerland', 'War in the Shadowlands'],
  },
  {
    name: 'The Lores of Magic', slug: 'the-lores-of-magic', sourcePath: '/the-lores-of-magic',
    topics: ['Spells & Spell Generation', 'Spell Categories', 'Battle Magic', 'Daemonology', 'Dark Magic', 'Elementalism', 'High Magic', 'Illusion', 'Necromancy', 'Waaagh! Magic'],
  },
  {
    name: 'Magic Items', slug: 'magic-items', sourcePath: '/magic-items',
    topics: ['Using Magic Items', 'Purchasing Magic Items', 'Types of Magic Item', 'Limitations & Uniqueness', 'Named Characters', 'Extremely Common Magic Items', 'Single Use Magic Items', "What's in a Name?", 'Magic Weapons', 'Magic Armour', 'Talismans', 'Magic Standards', 'Enchanted Items', 'Arcane Items'],
  },
  {
    name: 'Quick Reference', slug: 'quick-reference', sourcePath: '/',
    topics: [],
  },
  {
    name: 'Matched Play', slug: 'matched-play', sourcePath: '/matched-play',
    topics: ['Organising An Event', 'Roles & Responsibilties', 'Universal Rules', 'Scoring & Tiebreakers', 'The Pairing of Players', 'Army Composition', 'Open War', 'Grand Melee', 'Combined Arms', 'The Field of Battle', 'Setting Up Terrain', 'Matched Play Scenarios', 'Choosing Scenarios', 'Game Length', 'Fixed Turn Limit', 'Random Game Length', 'Break Point', 'Victory!', 'Victory Points', 'Common Objectives', 'Breaking the Enemy', 'Scenario 1: Upon the Field of Glory', 'Scenario 2: King of the Hill', 'Scenario 3: Drawn Battlelines', 'Scenario 4: Close Quarters', 'Scenario 5: A Chance Encounter', 'Scenario 6: Encirclement', 'Secondary Objectives', 'Baggage Trains', 'Domination', 'Strategic Locations (X)', 'Doubles Events', 'Team Events', 'Escalation Events', 'Secret Objectives'],
  },
  {
    name: 'Battle March', slug: 'battle-march', sourcePath: '/battle-march',
    topics: ['General Principles', 'Mustering A Battle March', 'Playing Battle March', 'Treasure Troves', 'Landmarks', 'Controlling Objectives', 'Battle March Deployment Maps', 'First Turn', 'Game Length', 'Victory Points', 'Secondary Objectives', 'Using Secondary Objectives', 'Raid & Burn', 'Baggage Carts', 'Random Happenings', 'Oddities of War', 'Using Random Happenings', 'Disruptive Weather', 'Wilderness Terrain', 'The Chaos of War', 'Matched Play', 'Organising An Event', 'Matched Play Muster Lists', 'Secret Objectives', 'Using Secret Objectives', 'Well-Laid Ambush', 'Scouting the Area', "Duellist's Flourish", 'Slay the Beast', 'Hold Them Back!', 'Reconnoitre', 'Outlast the Enemy', 'Gather Resources', 'Magical Mastery', 'Seize the Tower', 'Battle March Magic Items', 'Axe Bite Pass Scenarios', 'Forging a Narrative', 'Narrative Battles'],
  },
]

export const coreRuleEntrypoints: Record<string, string> = {
  'the-strategy-phase': '/the-strategy-phase/the-strategy-phase-sequence',
  'the-movement-phase': '/the-movement-phase/the-movement-phase-sequence',
  'the-shooting-phase': '/the-shooting-phase/the-shooting-phase-sequence',
  'the-combat-phase': '/the-combat-phase/the-combat-phase-sequence',
  'special-rules': '/special-rules/what-are-special-rules',
  'magic': '/magic/casting-spells',
  'weapons-of-war': '/weapons-of-war/weapon-profiles',
}

export type BattleScenarioEntry = {
  name: string
  sourcePath: string
  sectionSlug: string
}

export const battleScenarioEntries: BattleScenarioEntry[] = [
  { name: 'Pitched Battles', sourcePath: '/warhammer-battles', sectionSlug: 'warhammer-battles' },
  { name: 'Campaign Battles', sourcePath: '/campaign-battles', sectionSlug: 'campaign-battles' },
  { name: 'Narrative Battles', sourcePath: '/narrative-battles', sectionSlug: 'narrative-battles' },
  { name: 'Matched Play', sourcePath: '/matched-play', sectionSlug: 'matched-play' },
  { name: 'Battle March', sourcePath: '/battle-march', sectionSlug: 'battle-march' },
]

export const hiddenRuleSourcePaths = new Set(['/general-principles'])

// Lightweight repository landing pages are not exposed as Old.dex reader pages.
// They remain section identifiers for Quick Reference / Advanced Rules grouping.
export const nonReaderRuleSourcePaths = new Set([
  '/magic',
  '/the-strategy-phase',
  '/the-movement-phase',
  '/the-shooting-phase',
  '/the-combat-phase',
  '/special-rules',
  '/characters',
  '/weapons-of-war',
])

export const supportPages: SupportPage[] = [
  { name: 'Frequently Asked Questions', slug: 'faq', sourcePath: '/faq' },
  { name: 'Errata & Amendments', slug: 'errata', sourcePath: '/errata' },
]

